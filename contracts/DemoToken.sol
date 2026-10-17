// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @notice Test currency only. Unlimited faucet intentionally has no monetary value.
contract DemoToken is ERC20 {
    constructor() ERC20("Blitz Test Credit", "BLITZ") {}
    function faucet() external { _mint(msg.sender, 100_000 ether); }
}
