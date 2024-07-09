// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { IPendlePtOracle } from "../interfaces/IPendlePtOracle.sol";
import { OracleInterface } from "../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress, ensureNonzeroValue } from "@venusprotocol/solidity-utilities/contracts/validators.sol";
import "@venusprotocol/governance-contracts/contracts/Governance/AccessControlledV8.sol";
import "../interfaces/IStandardizedYield.sol";
import "../interfaces/IPMarket.sol";
import "../interfaces/IPPrincipalToken.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";

/**
 * @title PendleOracle
 * @author Venus
 * @notice This oracle fetches the price of a pendle token
 */
contract PendleOracle is AccessControlledV8, OracleInterface {
    struct TokenConfig {
        /// @notice Underlying token address, which can't be a null address
        /// @notice Used to check if a token is supported
        address asset;
        /// @notice Address of the market
        address market;
        /// @notice Twap duration for the oracle
        uint32 twapDuration;
    }

    /// @notice Address of the PT oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    IPendlePtOracle public underlyingPtOracle;

    OracleInterface public intermediateOracle;

    /// @notice Token config by assets
    mapping(address => TokenConfig) public tokenConfigs;

    /// @notice Emit when a token config is added
    event TokenConfigAdded(address indexed asset, address market, uint32 twapDuration);

    /// @notice Emit when setting a new pt oracle address
    event PtOracleSet(address indexed oldOracle, address indexed newOracle);

    event IntermediateOracleSet(address indexed oldOracle, address indexed newOracle);

    event UnderlyingAssetSet(address indexed oldAddress, address indexed newAddress);

    /// @notice Thrown if the duration is invalid
    error InvalidDuration();

    modifier notNullAddress(address someone) {
        if (someone == address(0)) revert("can't be zero address");
        _;
    }

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initializes the owner of the contract
     * @param accessControlManager_ Address of the access control manager contract
     */
    function initialize(address accessControlManager_, address ptOracle, address resilientOracle) external initializer {
        __AccessControlled_init(accessControlManager_);
        ensureNonzeroAddress(ptOracle);
        ensureNonzeroAddress(resilientOracle);

        underlyingPtOracle = IPendlePtOracle(ptOracle);
        emit PtOracleSet(address(0), address(underlyingPtOracle));

        intermediateOracle = OracleInterface(resilientOracle);
        emit IntermediateOracleSet(address(0), address(intermediateOracle));
    }

    /**
     * @notice Add multiple token configs at the same time
     * @param tokenConfigs_ config array
     * @custom:access Only Governance
     * @custom:error Zero length error thrown, if length of the array in parameter is 0
     */
    function setTokenConfigs(TokenConfig[] memory tokenConfigs_) external {
        if (tokenConfigs_.length == 0) revert("length can't be 0");
        uint256 numTokenConfigs = tokenConfigs_.length;
        for (uint256 i; i < numTokenConfigs; ) {
            setTokenConfig(tokenConfigs_[i]);
            unchecked {
                ++i;
            }
        }
    }

    /**
     * @notice Set the underlying Pt oracle contract address
     * @param underlyingPtOracle_ Pt oracle contract address
     * @custom:access Only Governance
     * @custom:error NotNullAddress error thrown if underlyingPtOracle_ address is zero
     * @custom:event Emits PtOracleSet event with address of Pt oracle.
     */
    function setUnderlyingPtOracle(
        IPendlePtOracle underlyingPtOracle_
    ) external notNullAddress(address(underlyingPtOracle_)) {
        _checkAccessAllowed("setUnderlyingPtOracle(address)");
        require(address(underlyingPtOracle_) != 0x0000000000000000000000000000000000000000, "invalid address");
        IPendlePtOracle oldOracle = underlyingPtOracle;
        underlyingPtOracle = underlyingPtOracle_;
        emit PtOracleSet(address(oldOracle), address(underlyingPtOracle));
    }

    /**
     * @notice Set the underlying Pyth oracle contract address
     * @param intermediateOracle_ Pyth oracle contract address
     * @custom:access Only Governance
     * @custom:error NotNullAddress error thrown if intermediateOracle_ address is zero
     * @custom:event Emits IntermediateOracleSet event with address of Pyth oracle.
     */
    function setIntermediateOracle(
        OracleInterface intermediateOracle_
    ) external notNullAddress(address(intermediateOracle_)) {
        _checkAccessAllowed("setIntermediateOracle(address)");
        require(address(intermediateOracle_) != 0x0000000000000000000000000000000000000000, "invalid address");
        OracleInterface oldOracle = intermediateOracle;
        intermediateOracle = intermediateOracle_;
        emit IntermediateOracleSet(address(oldOracle), address(intermediateOracle_));
    }

    /**
     * @notice Add single token config. asset & feed cannot be null addresses and maxStalePeriod must be positive
     * @param tokenConfig Token config struct
     * @custom:access Only Governance
     * @custom:error NotNullAddress error is thrown if asset address is null
     * @custom:error NotNullAddress error is thrown if token feed address is null
     * @custom:error Range error is thrown if twap duration of token is not greater than zero
     * @custom:event Emits TokenConfigAdded event on succesfully setting of the token config
     */
    function setTokenConfig(
        TokenConfig memory tokenConfig
    ) public notNullAddress(tokenConfig.asset) notNullAddress(tokenConfig.market) {
        _checkAccessAllowed("setTokenConfig(TokenConfig)");
        ensureNonzeroValue(tokenConfig.twapDuration);

        if (tokenConfig.twapDuration == 0) revert("twap duration can't be zero");
        (bool increaseCardinalityRequired, , bool oldestObservationSatisfied) = underlyingPtOracle.getOracleState(
            tokenConfig.market,
            tokenConfig.twapDuration
        );
        if (increaseCardinalityRequired || !oldestObservationSatisfied) {
            revert InvalidDuration();
        }

        (IStandardizedYield sy, IPPrincipalToken pt, ) = IPMarket(tokenConfig.market).readTokens();
        if (tokenConfig.asset != address(pt)) revert("pt mismatch");
        if (pt.SY() != address(sy)) revert("sy mismatch");

        tokenConfigs[tokenConfig.asset] = tokenConfig;
        emit TokenConfigAdded(tokenConfig.asset, tokenConfig.market, tokenConfig.twapDuration);
    }

    /**
     * @notice Gets the price of a asset from the chainlink oracle
     * @param asset Address of the asset
     * @return Price in USD from Chainlink or a manually set price for the asset
     */
    function getPrice(address asset) public view virtual returns (uint256) {
        TokenConfig memory tokenConfig = tokenConfigs[asset];
        if (tokenConfig.asset != asset) revert("unknown token");
        uint256 rate = underlyingPtOracle.getPtToSyRate(tokenConfig.market, tokenConfig.twapDuration);

        (IStandardizedYield sy, , ) = IPMarket(tokenConfig.market).readTokens();
        return (intermediateOracle.getPrice(sy.yieldToken()) * rate) / EXP_SCALE;
    }
}
