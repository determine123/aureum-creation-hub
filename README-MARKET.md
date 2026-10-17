# AUREUM 固定价格虚拟币集市

本版本取代竞拍入口，保留原竞拍源文件 web/auction-legacy.tsx 供回退。沿用现有 React/Vite/ethers 工程，未迁移 Next.js/Para。

## 功能
- MarketAsset (AUR)：可领取的测试商品代币。
- DemoToken (BLITZ)：可领取的测试支付代币。
- TokenMarket：发布时托管 AUR，整单购买时原子转账，下架返还 AUR。
- 合约分页读取商品，不需要数据库。我的发布/购买筛选作用于当前页，可翻页查看。
- 钱包余额、授权、发布、购买、下架均读取或写入链上状态。授权仅申请本次所需数额。
- 当前支持配置的两种标准测试币；不支持手续费代币。
- 交易 Gas 估算后加 10% 缓冲。

## 本地演示
运行 npm run chain，然后 npm run deploy:market:local，再运行 npm run dev。
打开设置，连接本地演示钱包编号 0，领取 AUR，发布商品。切换编号 1，领取 BLITZ，购买。
也可用浏览器钱包部署：设置中使用 Monad 测试网配置，连接钱包，确认 3 笔部署交易。
部署中拒签可留下已部署合约，重试会重新部署整套合约并产生 Gas；不要重复点击。
部署所得配置目前保存于浏览器 localStorage。对外发布前必须将地址写入 web/market-deployment.json，并重新构建。
原竞拍合约地址不适用于本市场。市场需要 asset、currency、market 三个地址。

## 验证
npm run test:market
npm run build

仅测试网演示，代币无实际价值。尚未部署或验证公共测试网合约，尚未发布公共网址。
