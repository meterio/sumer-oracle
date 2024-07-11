// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { CorrelatedTokenOracle } from "./common/CorrelatedTokenOracle.sol";
import { EXP_SCALE } from "../utilities/constants.sol";
import { ensureNonzeroAddress } from "../utilities/validators.sol";

interface IWstMTRG {
    function stMTRGPerToken() external view returns (uint256);
}

/**
 * @title wstMTRGOracle
 * @author Venus
 * @notice This oracle fetches the price of weETH
 */
contract WstMTRGOracle is CorrelatedTokenOracle {
    /// @notice Constructor for the implementation contract.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address MTRG, address resilientOracle) CorrelatedTokenOracle(MTRG, resilientOracle) {}

    /**
     * @notice Gets the eETH for 1 weETH
     * @return amount Amount of eETH
     */
    function _getUnderlyingAmount(address correlatedToken) internal view override returns (uint256) {
        return IWstMTRG(correlatedToken).stMTRGPerToken();
    }
}
