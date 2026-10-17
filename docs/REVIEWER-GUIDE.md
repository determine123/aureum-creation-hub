# AUREUM 评审入口与可核验证据

## 30 秒定位

创想集让项目、Ideas、工具、资料与其他作品拥有公开的链上目录。读者免费浏览，用测试 BLITZ 表达支持。支持篮将多份认可合并为一笔原子交易，资金直接抵达作者，无平台抽成或资金托管。

公开前端：https://determine123.github.io/aureum-creation-hub/

公开源码：https://github.com/determine123/aureum-creation-hub

公共测试网已配置经 RPC 与历史源码字节码核验的旧版合约（支持单笔流程，不含 supportBatch）；两份旧版合约的区块浏览器验证均已成功；新版批量合约部署和线上写操作验收仍待完成。 公开页面可访问不代表写操作已完成验收。测试代币不代表购买力、声誉、真实需求或可持续代币经济。

Real Monad 三项致命问题的逐条回应与证据索引见 [REVIEW-RESPONSE.md](REVIEW-RESPONSE.md)。

## 直接阅读实现

- `components/CreationHubApp.tsx`：真实前端入口，包括目录、分类、搜索、详情、发布、收藏、归档和批量支持。
- `components/PublishGasPreview.tsx`：发布前使用 RPC 估算 Gas，显示 UTF-8 正文字节数、Gas 上限、当前费率估算及费用上限。
- `components/TransactionEvidencePanel.tsx`：本次浏览器会话的真实回执、交易链接、费用、等待时间和 JSON 导出。
- `contracts/CreationHub.sol`：发布、单笔/批量支持、收藏、归档及有界分页。
- `test/hub.test.mjs`：多作者精确到账、整批回滚、权限和边界。
- `scripts/hub-browser-qa.mjs`：从浏览到发布、两项批量支持、凭证导出的真实本地链端到端测试。
- `benchmarks/local-evm.json`：可重跑的本地测量，明确标注链 ID 与范围。
- `submission/aureum-demo.mp4`：17 秒本地链录屏，展示支持篮、授权与一笔 `supportBatch`；`submission/screenshots/03-batch-basket.png` 为支持篮截图。

前端主页面与可复用组件位于 `components/`，`web/main.tsx` 是挂载入口，`web/` 还保留链连接、钱包、水龙头、样式和生成的 ABI。目录已兼容仅识别常见前端目录的静态扫描器。历史竞拍/交易合约不属于本次功能亮点。

## 为什么选择 Monad

应用使用标准 EVM 合约，这是兼容性优势。Monad 的并行执行对应用保持顺序 EVM 语义，不要求为了比赛重写一份专有合约。我们不将“存在批处理函数”说成“证明了并行执行”或“获得高 TPS”。

支持篮在一个有界调用中重用 token 和账户访问，减少多笔交易的固定开销；最多 20 项，禁止重复、自我支持、零金额、归档作品，任一错误整体回滚。它仍会写入总支持额和作者计数，不能宣称没有共享状态竞争。Monad 测试网上的只读模拟已经给出新版字节码的成本上界；真实回执和跨链费用对照仍待补齐。

Monad 按 gas_limit 计费，因此每次先估算，再设置 10% 余量。发布费用预览使用相同规则，以当前费率和 maxFeePerGas 分别展示估算与上限。RPC 不可用时不编造费用。正文上链并非免费，较大附件应放在公开外部链接；链上不能保证外部链接永久可用。

## 复现实测

```sh
npm ci
npm run test:hub
npm run test:hub:browser
npm run benchmark:hub
npm run build
```

`npm run demo:video` 会启动独立本地链并录制批量支持流程，需要本机 Edge 与 Playwright 的 ffmpeg 组件；它不会访问公共测试网或签名真实资产。

本地基准依次测量 100、1,000、6,000 字节正文，以及三位不同作者的三次单笔支持和一笔三项批量支持。两种支持方式通过 snapshot/revert 使用相同起始状态，均不含授权交易。当前结果为单笔合计 380,145 Gas、批量 299,020 Gas，每项 126,715 → 99,673 Gas，约节省 21.34%。Gas 数值不等于跨网络费用，Ganache 延迟也不代表 Monad 确认时间。

真实测试网部署后可执行只读估算：

```sh
npm run benchmark:hub -- --testnet --config path/to/testnet-config.json --account 0x你的公开地址
```

此模式校验链 10143 和合约代码，调用 estimateGas，不签名、不发送交易，不需要私钥。报告写入 `benchmarks/monad-estimates.json`。它只是估算，不能用作已成交交易或性能压力测试证据。

新版字节码尚未部署时，也可以运行只读 state-override 模拟：

```sh
npm run testnet:simulate -- --account 0x你的公开地址
```

脚本把当前 `CreationHub` 运行时代码、测试币余额/授权和作品行注入 Monad RPC 的一次 `eth_estimateGas` 调用。当前结果为三位不同作者单笔合计 527,145 Gas、批量 354,571 Gas（32.74%），20 项上限 1,792,860 Gas，新版 hub 部署 1,558,541 Gas。报告写入 `benchmarks/monad-batch-simulation.json`，明确标注“未发送交易、模拟地址没有代码”。它不能替代真实部署、源码验证或 `supportBatch` 回执。

## 路演顺序

1. 先展示网络与真实合约地址；若仍为本地链，明确说明。
2. 无钱包浏览，打开一个 Idea 的详情，说明公开内容和归档边界。
3. 作者填写正文，展示字节计数与费用预览，再确认发布。
4. 支持者选择两个作品、填写每份数量，确认必要授权与批量支持。
5. 查看双方余额、本次交易凭证、区块浏览器；导出 JSON 供核验。

公共测试网上线后的必补材料：新版 `CreationHub` 地址、部署交易 hash、验证链接、至少一笔真实发布与 `supportBatch` 交易，以及真实线上截图。新版 hub 部署后执行 `npm run finalize:testnet -- 配置.json --account 0x公开地址`，一次完成地址校验、写入公共配置、验证请求、RPC 估算和模拟复跑。未取得前不填写占位地址，也不把本地截图或 state-override 估算描述为公共交易。
