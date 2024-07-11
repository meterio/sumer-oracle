// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { OracleInterface } from "../../interfaces/OracleInterface.sol";
import { ensureNonzeroAddress } from "../../utilities/validators.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { EXP_SCALE } from "../../utilities/constants.sol";
/**
 * @title CorrelatedTokenOracle
 * @notice This oracle fetches the price of a token that is correlated to another token.
 */
abstract contract CorrelatedTokenOracle is OracleInterface {
    /// @notice Address of the underlying token
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    address public immutable UNDERLYING_TOKEN;

    /// @notice Address of Resilient Oracle
    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    OracleInterface public immutable RESILIENT_ORACLE;

    /// @notice Thrown if the token address is invalid
    error InvalidTokenAddress();

    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address underlyingToken, address resilientOracle) {
        ensureNonzeroAddress(underlyingToken);
        ensureNonzeroAddress(resilientOracle);
        UNDERLYING_TOKEN = underlyingToken;
        RESILIENT_ORACLE = OracleInterface(resilientOracle);
    }

    /**
     * @notice Fetches the price of the correlated token
     * @param correlatedToken Address of the correlated token
     * @return price The price of the correlated token in scaled decimal places
     */
    function getPrice(address correlatedToken) external view override returns (uint256) {
        // get underlying token amount for 1 correlated token scaled by underlying token decimals
        uint256 underlyingAmount = _getUnderlyingAmount(correlatedToken);

        // oracle returns (36 - asset decimal) scaled price
        uint256 underlyingUSDPrice = RESILIENT_ORACLE.getPrice(UNDERLYING_TOKEN);

        // IERC20Metadata token = IERC20Metadata(CORRELATED_TOKEN);
        // uint256 decimals = token.decimals();

        // underlyingAmount (for 1 correlated token) * underlyingUSDPrice / decimals(correlated token)
        return (underlyingAmount * underlyingUSDPrice) / EXP_SCALE;
    }

    /**
     * @notice Gets the underlying amount for correlated token
     * @return underlyingAmount Amount of underlying token
     */
    function _getUnderlyingAmount(address asset) internal view virtual returns (uint256);
}
