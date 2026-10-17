# 对 Real Monad 预审的回应

基线报告：70/100，Monad 适配度 6.8/10。报告评审的是较早提交；本页只记录这次修订新增的证据和仍然存在的边界。

## 三个最致命问题的处理

| 预审问题 | 本次新增证据 | 仍然不能声称的事 | 下一步 |
| --- | --- | --- | --- |
| 测试币支持不等于真实需求 | `docs/USER-VALIDATION.md` 已提供访谈与任务模板；README、提交文档明确不把测试币金额当付费意愿或留存 | 没有真实用户样本，不能声称需求已验证 | 邀请 5–10 位创作者/支持者完成模板，记录成功、失败和原话 |
| 新版批量合约未部署到公共测试网 | 新增“仅部署新版平台（1 笔，复用测试币）”路径、`finalize:testnet` 一键收尾脚本，以及新版精确字节码的 Monad RPC state-override 模拟 | 模拟地址没有代码；没有真实 `supportBatch` 回执，不能把旧版说成新版 | 用钱包确认 1 笔 hub 部署，下载配置，运行 `finalize:testnet` 并提交交易 hash/验证结果 |
| Monad 特性利用浅，缺少批量网络证据 | 新版字节码在 Monad 测试网 RPC 上模拟：三位不同作者单笔合计 527,145 Gas，批量 354,571 Gas（32.74%）；20 项上限 1,792,860 Gas；部署估算 1,558,541 Gas | 这是 `eth_estimateGas`，不是成交回执、确认延迟或跨链费用比较；共享 `totalSupport` 仍是并发热点 | 部署后补真实回执；再做至少一条对照链的同状态估算，决定是否重构计数器 |

## 预审行动清单的对应结果

| 报告建议 | 当前状态 | 证据 |
| --- | --- | --- |
| 运行测试网 Gas 估算并补充 README | 已完成“只读模拟 + 部署估算”；真实合约估算等新 hub 部署后执行 | `benchmarks/monad-batch-simulation.json`、README |
| 部署新版批量合约并验证 | 代码、部署按钮、配置导出和一键收尾命令已就绪；等待钱包确认 1 笔交易 | `/?deploy=1`、`scripts/finalize-testnet.mjs` |
| 录制 30 秒演示 | 已生成 17 秒本地链录屏（支持篮、授权、`supportBatch` 回执）；另有 30 秒口播稿 | `submission/aureum-demo.mp4`、`DEMO-SCRIPT.md` |
| 在 MONAD-FIT 中解释并行/高吞吐 | 已补充共享状态、并行边界、跨链比较的诚实说明 | `docs/MONAD-FIT.md` |

## 这次修订的关键数字

本地 Ganache、同起点、三位不同作者、均排除授权：

- 三笔单笔支持合计 380,145 Gas
- 一笔三项批量支持 299,020 Gas
- 每项 126,715 → 99,673 Gas，减少约 21.34%

Monad 测试网 10143、新版精确运行时代码、`eth_estimateGas` + state override、未发送交易：

- 三笔单笔合计 527,145 Gas
- 一笔三项批量 354,571 Gas，减少 172,574 Gas（32.74%）
- 20 项批量上限 1,792,860 Gas
- 新版 hub 部署估算 1,558,541 Gas
- 发布 100/1,000/6,000 字节正文分别估算 285,019 / 784,627 / 3,578,803 Gas

这些数字都不能直接当作成交费用或确认时间。Monad 按 gas limit 计费，前端估算加 10% 余量；真实回执才包含实际 gas used、费率和区块。

## 复核命令

```sh
npm ci
npm test
npm run benchmark:hub
npm run testnet:simulate -- --account 0x37F416f3945b1d40b888868b7C0B37605d446C1e
npm run build
```

部署新版 hub 后：

```sh
npm run finalize:testnet -- path/to/aureum-testnet-config.json --account 0x你的公开地址
```

## 证据索引

- `benchmarks/local-evm.json`：本地 EVM 多作者基准
- `benchmarks/monad-batch-simulation.json`：Monad 只读模拟（新版字节码）
- `benchmarks/monad-estimates.json`：旧版公共合约的正文 RPC 估算
- `deployment/testnet-audit.json`：旧版合约的 RPC 与历史字节码核验
- `verification/`：旧版合约的区块浏览器验证响应
- `test/hub.test.mjs`：批量支持、原子回滚、权限与边界
- `scripts/hub-browser-qa.mjs`：真实本地链浏览器端到端流程

## 仍然缺什么

1. 新版 `CreationHub` 的公共地址、部署交易 hash 和浏览器验证结果。
2. 至少一笔真实发布和一笔真实 `supportBatch` 回执，且 hub 地址与公共前端配置一致。
3. 5–10 位真实用户的试用记录；没有样本时保留“产品假设未验证”。
4. 用真实回执和对照链同状态估算回答“为什么不是任意 EVM 链”，不靠宣传语。
