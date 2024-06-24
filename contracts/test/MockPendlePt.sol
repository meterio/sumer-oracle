// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.6.0) (token/ERC20/ERC20.sol)

pragma solidity ^0.8.0;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockPendlePt is ERC20, Ownable {
    uint8 private immutable _decimals;
    uint256 public exchangeRate;
    address public syToken;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address syToken_
    ) ERC20(name_, symbol_) Ownable() {
        _decimals = decimals_;
        syToken = syToken_;
    }

    function faucet(uint256 amount) external {
        _mint(msg.sender, amount);
    }

    function decimals() public view virtual override(ERC20) returns (uint8) {
        return _decimals;
    }

    function SY() public view returns (address) {
        return syToken;
    }
}
