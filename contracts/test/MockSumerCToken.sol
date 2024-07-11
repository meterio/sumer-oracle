// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "./BEP20Harness.sol";

contract MockSumerCToken is BEP20Harness {
    address public underlying;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address underlying_
    ) BEP20Harness(name_, symbol_, decimals_) {
        underlying = underlying_;
    }

    function setUnderlying(address underlying_) public {
        underlying = underlying_;
    }
}
