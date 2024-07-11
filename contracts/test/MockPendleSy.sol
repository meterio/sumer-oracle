// SPDX-License-Identifier: BSD-3-Clause
pragma solidity 0.8.25;

import "./BEP20Harness.sol";

contract MockPendleSy is BEP20Harness {
    address public yieldToken;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address yieldToken_
    ) BEP20Harness(name_, symbol_, decimals_) {
        yieldToken = yieldToken_;
    }

    function setYieldToken(address yieldToken_) public {
        yieldToken = yieldToken_;
    }
}
