// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { EXP_SCALE } from "@venusprotocol/solidity-utilities/contracts/constants.sol";
import { ensureNonzeroAddress } from "@venusprotocol/solidity-utilities/contracts/validators.sol";

interface IWstMTRG {
    function stMTRGPerToken() external view returns (uint256);
}

/**
 * @title wstMTRGOracle
 * @author Venus
 * @notice This oracle fetches the price of weETH
 */
contract wstMTRGOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(
        address wstMTRG,
        address MTRG,
        address resilientOracle
    ) CorrelatedTokenOracle(wstMTRG, MTRG, resilientOracle) {}

    /**
     * @notice Gets the eETH for 1 weETH
     * @return amount Amount of eETH
     */
    function _getUnderlyingAmount() internal view override returns (uint256) {
        return IWstMTRG(CORRELATED_TOKEN).stMTRGPerToken();
    }
}
