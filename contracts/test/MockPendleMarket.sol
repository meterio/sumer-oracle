// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IAnkrBNB } from "../interfaces/IAnkrBNB.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPendleMarket is Ownable {
    uint8 private immutable _decimals;
    uint256 public exchangeRate;
    address public syToken;
    address public ptToken;
    address public ytToken;

    constructor(address sy_, address pt_, address yt_) Ownable() {
        syToken = sy_;
        ptToken = pt_;
        ytToken = yt_;
    }

    function writeTokens(address sy_, address pt_, address yt_) public onlyOwner {
        syToken = sy_;
        ptToken = pt_;
        ytToken = yt_;
    }

    function readTokens() public view returns (address, address, address) {
        return (syToken, ptToken, ytToken);
    }
}
