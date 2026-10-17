// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
/// @notice Test tokens only, no monetary value.
contract MarketAsset is ERC20 {constructor() ERC20("Aureum Demo Coin","AUR") {} function faucet() external {_mint(msg.sender,100_000 ether);}}