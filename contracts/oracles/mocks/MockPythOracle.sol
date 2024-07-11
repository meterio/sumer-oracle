// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IPyth } from "../PythOracle.sol";
import { OracleInterface } from "../../interfaces/OracleInterface.sol";

contract MockPythOracle is Ownable {
    mapping(address => uint256) public assetPrices;

    /// @notice the actual pyth oracle address fetch & store the prices
    IPyth public underlyingPythOracle;

    //set price in 6 decimal precision

    constructor(address underlyingPythOracle_) {
        if (underlyingPythOracle_ == address(0)) revert("pyth oracle cannot be zero address");
        underlyingPythOracle = IPyth(underlyingPythOracle_);
    }

    function setPrice(address asset, uint256 price) external {
        assetPrices[asset] = price;
    }

    //https://compound.finance/docs/prices
    function getPrice(address token) public view returns (uint256) {
        return assetPrices[token];
    }
}
