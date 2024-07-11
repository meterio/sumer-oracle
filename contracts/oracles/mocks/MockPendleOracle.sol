// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPendlePtOracle } from "../../interfaces/IPendlePtOracle.sol";
import { OracleInterface } from "../../interfaces/OracleInterface.sol";

contract MockPtOracle is Ownable {
    mapping(address => uint256) public assetPrices;

    /// @notice the actual Pt oracle address fetch & store the prices
    IPendlePtOracle public underlyingPtOracle;

    OracleInterface public intermediateOracle;

    constructor(address underlyingPtOracle_, address intermediateOracle_) {
        if (underlyingPtOracle_ == address(0)) revert("Pt oracle cannot be zero address");
        underlyingPtOracle = IPendlePtOracle(underlyingPtOracle_);

        if (intermediateOracle_ == address(0)) revert("intermediate oracle cannot be zero address");
        intermediateOracle = OracleInterface(intermediateOracle_);
    }

    function setPrice(address asset, uint256 price) external {
        assetPrices[asset] = price;
    }

    //https://compound.finance/docs/prices
    function getPrice(address token) public view returns (uint256) {
        return assetPrices[token];
    }
}
