// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// 引入 OpenZeppelin 的標準 ERC-20 合約
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SkillToken is ERC20, Ownable {
    // 建構子：設定代幣名稱為 SkillToken，代號為 SKILL，並指定合約擁有者
    constructor(address initialOwner) ERC20("SkillToken", "SKILL") Ownable(initialOwner) {
        // 初始發行 100 萬顆代幣給建立者 (ERC20 預設有 18 位小數)
        _mint(msg.sender, 1000000 * 10**decimals());
    }

    // 允許平台（擁有者）未來可以增發代幣（例如使用者完成任務給予獎勵）
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}