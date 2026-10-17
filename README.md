# AUREUM · 创想集

为 Monad Blitz 构建的开放创意与成果分享平台。项目、Ideas、工具、资料和其他创造，都能公开发布；读者免费浏览，用测试虚拟币表达支持。参考「传承·交大」的共享定位，使用独立品牌与原创演示内容，不代表上海交通大学官方项目。

评审请先看 [实现入口与证据指南](docs/REVIEWER-GUIDE.md)。真实前端在 `components/CreationHubApp.tsx`，不是 `app/` 或 `pages/`。

Real Monad 的四项输入可直接使用 [重新评审填写稿](submission/REAL-MONAD.md)，其中区分已实现、本地实测和公共测试网待办，并提供 7 个评委追问的回答边界。

核心场景是“逛一次作品展，支持多个好想法”：读者发现项目、Ideas 等不同作品后，把最多 20 份加入支持篮，必要时先授权，再用一笔原子交易支持多个作者。这是待真实用户验证的产品假设；测试币支持金额不代表声誉、真实需求或持续收入。

## 已核验并验证的 Monad 测试网地址

- DemoToken：[0x96d09DaD56d6ebbD2BB53832DA4fFaAc24f68F65](https://testnet.monadscan.com/address/0x96d09DaD56d6ebbD2BB53832DA4fFaAc24f68F65#code)。
- CreationHub：[0x86a520A1d3581750e3c2D2Ed5d99B01dC54801Db](https://testnet.monadscan.com/address/0x86a520A1d3581750e3c2D2Ed5d99B01dC54801Db#code)。这是旧版，仅支持单笔支持，不含批量接口。
- 运行时代码与历史源码 5d067e9 匹配（仅按编译器 immutableReferences 排除构造时填入的不可变量）；币种、精度与 hub.token 关联均通过 RPC 核验。
- 原始证据见 [公共链核验记录](deployment/testnet-audit.json) 与 [Monad RPC 估算](benchmarks/monad-estimates.json)。6,000 字节正文在记录费率下约 0.396391584 MON（含 10% 余量），是只读估算，不是成交费用或延迟测量。
- 复用已有币部署新版：设置中连接钱包，点击“仅部署新版平台（1 笔，复用测试币）”。这是新合约部署，不迁移旧作品、授权或收藏；现有 BLITZ 余额保留在原代币。
- 旧版合约在 Monadscan 与 Monadvision 均已验证成功，响应保存在 verification/。发布/支持交易 hash 与新版批量合约地址仍须补齐。

## 新增：灵感支持篮与交易证据

- 最多 20 份作品合并为一笔批量支持，必要时先按本次总额授权。任一项失败，全批回滚，资金直接抵达作者。合约禁止重复项、自我支持、零金额及归档作品。
- 发布表单显示 UTF-8 字节计数、真实 RPC Gas 估算、10% 余量和 MON 费用上限。Monad 按 gas_limit 计费，界面不使用本地费用冒充公共测试网费用。
- 发布、收藏、领取和支持的真实回执可在页面查看，导出本次会话 JSON；记录含链 ID、hash、区块、Gas 上限、Gas 使用和费用。钱包等待时间不当作链确认性能基准。
- `npm run benchmark:hub` 生成 `benchmarks/local-evm.json`。当前同起点、同作者三项支持实测：单笔合计 311,733 Gas，批量 211,408 Gas，节省约 32.18%；双方均排除授权，仅为本地 EVM 结果，不代表 Monad 或不同作者场景。
- 公共测试网部署后，`npm run benchmark:hub -- --testnet --config path/to/testnet-config.json --account 0x公开地址` 只读估算 100/1,000/6,000 字节正文成本，不签名或发送交易。

批量支持需要新版 CreationHub；旧合约只支持单笔时页面自动禁用支持篮并提示，不会把前端更新冒充合约升级。新部署字节码已包含 supportBatch。EVM 批处理是顺序执行，不等于 Monad 并行性能实测；项目仍有共享统计状态，没有声称无竞争或高 TPS。

## 交付状态

- 已实现：公开浏览、五种类型、关键词检索、排序、作品详情、作者筛选、链上收藏、发布、归档/恢复、测试币领取、直接到作者钱包的打赏。
- 已实现：本地链一键演示、浏览器钱包测试网部署入口、公共地址校验与区块浏览器验证脚本。
- 已创建公开源码仓库：https://github.com/determine123/aureum-creation-hub 。已配置 GitHub Pages 自动部署；最终部署状态以 Actions 与匿名访问验收为准。
- 公共前端：https://determine123.github.io/aureum-creation-hub/ ，已通过匿名浏览、静态资源、钱包部署向导与手机布局验收；公共链写操作仍待真实交易验收。
- 公共测试网已配置经 RPC 与历史源码字节码核验的旧版合约（支持单笔流程，不含 supportBatch）；两份旧版合约的区块浏览器验证均已成功；新版批量合约部署和线上写操作验收仍待完成。
- 历史竞拍和代币买卖代码保留在仓库中，本版首页仅使用 CreationHub，不运行竞拍流程。

## 快速体验

Node.js 20+，安装依赖后：

```sh
npm ci
npm run demo
```

打开 http://127.0.0.1:15175 。脚本启动本地链 18645，真实部署测试币与平台合约，并将 5 条原创示例和少量示例支持交易写入本地链。演示内容不是从参考站复制。

需要与旧演示并存时，可运行 `npm run demo -- --port 3001 --rpc-port 18648`，打开 http://127.0.0.1:3001/ 。新实例独立建链，不迁移或覆盖旧链作品。

1. 未连接钱包即可浏览，尝试分类、搜索、打开详情。
2. 选择演示钱包 1，连接后发布一个 Idea / 项目。
3. 切换演示钱包 2 并重新连接，领取测试 BLITZ。
4. 收藏新作品，打开详情，填写数量，确认授权与支持。
5. 作者钱包余额与累计支持同步增加；刷新重连后收藏仍存在。
6. 作者可以归档、恢复自己的作品。

本地演示使用内存链，重启后重建示例。启动脚本通过开发服务器的 VITE_LOCAL_DEMO 注入本地地址，不修改公共配置。发布前仍需确认 web/hub-deployment.json 是经过校验的测试网配置；旧演示留下的本地地址不得发布。

## Monad 测试网部署

用户在浏览器钱包中确认交易，不索取私钥：

1. 运行 npm run dev，打开 http://localhost:3000/?deploy=1 进入部署向导。请在装有钱包扩展的 Edge/Chrome 配置文件中打开；内置浏览器通常不提供扩展钱包。
2. 配置 chainId 10143、rpcUrl https://testnet-rpc.monad.xyz，token/hub 先留空。
3. 保存，连接有测试 MON 的浏览器钱包。
4. 点「钱包部署」，分别确认 DemoToken 与 CreationHub 两笔交易。中途拒签后可重试，已部署的币地址保存在本机，按链与账户区分。
5. 复制设置里的配置到 JSON 文件，执行以下命令。

向导显示检测到的钱包数量并支持 EIP-6963 多钱包选择。若显示 0 个，检查扩展是否在当前浏览器配置文件启用、是否允许访问此网站，解锁后刷新或重新检测。钱包安装仅使用 MetaMask/Rabby 官方渠道，不向网站或开发者提供助记词。

```sh
npm run configure:hub -- path/to/testnet-config.json
npm run verify:hub
npm run build
```

配置示例（必须填真实地址）：

```json
{"chainId":10143,"rpcUrl":"https://testnet-rpc.monad.xyz","token":"0x...","hub":"0x..."}
```

校验脚本检查真实链 ID、合约字节码、币符号/精度以及 hub.token 关联。验证脚本调用 monskills verification API，保存响应；API 接收请求不代表已经验证通过，仍需查看响应与浏览器状态。

## 前端发布

静态输出为 dist/，已有 Vercel 与 Cloudflare Pages 的路由回退配置。公共构建必须使用测试网共享地址，不能仅设置开发者浏览器的 localStorage。默认浏览无需登录或连接钱包。所有写操作需要钱包签名和 MON Gas。

GitHub Pages 自动部署工作流为 .github/workflows/pages.yml，推送 main 后先运行合约测试，再以仓库子路径构建并部署。仓库 Pages 发布源使用 GitHub Actions。公共配置更新后推送即可重新发布。站点没有已配置合约时会明确显示“尚未配置合约”，不会伪造链上作品或用本地地址代替测试网。

## MON 水龙头接入

点击顶部「MON 水龙头」，或使用 ?faucet=1 打开。MON 为测试网 Gas 币，BLITZ 为站内打赏测试币，二者分开。

- 无需连接钱包即可输入地址，复制后前往 https://faucet.monad.xyz/ 人工领取。
- 返回页面时立即刷新；页面可见时每 15 秒轮询一次。使用 eth_chainId 校验 10143，再通过 eth_getBalance(address, finalized) 查询，不发送交易或领取请求。
- 领取记录保存在本机，和链上当前余额分开；RPC 超时、错误或网络不匹配时显示未知，不显示假零余额。
- 可通过 ?faucet=1&address=收款地址&claimed=100 预填用户提供的领取记录。参数只是记录，不证明链上到账；记录不会作为余额或签名权限使用。
- 连接钱包后可切到测试网；连接地址与查询地址不同会提示。收款地址不在项目源码中硬编码，不索取私钥。

运行 npm run test:faucet:browser，回归使用受控 RPC 响应验证轮询、复制、地址校验、失败状态、网络校验及手机布局；不会实际申领测试币。

## 合约与数据

- contracts/CreationHub.sol：公开创作目录，分页每次最多 20 条，个人收藏映射，作者归档权限，测试币支持统计。
- contracts/DemoToken.sol：OpenZeppelin ERC20，BLITZ 无限演示水龙头，无实际价值，不是可持续代币经济。
- 正文（最多 6000 UTF-8 字节）、摘要、链接与作者公开上链，不提供付费解密。大附件可使用外部公开链接，链接可用性不由链保证。
- 支持通过 SafeERC20 直接从支持者转至作者；交易失败时统计整体回滚，平台不托管打赏资金，不允许自我打赏。
- 搜索、分类、排序、个人筛选针对已加载的作品。初始 20 条，可继续加载；界面显示已加载/总数。
- 归档只从发现页隐藏，不删除链上数据。收藏需要交易，取消收藏会更新链上计数。
- 地址仅标识钱包，不验证交大学生身份；不存在 jAccount 接入或学校背书。
- 保留既有 React + TypeScript + Vite + ethers 栈；使用现有 monskills、OpenZeppelin 和 Solidity 编译流程，不声称迁移为 Next.js/Para。

## 验证命令

```sh
npm run test:hub
npm run test:hub:browser
npm run build
```

浏览器回归使用本机 Edge，独立链端口 18646、前端 15176；涵盖匿名浏览、发布 Idea、分类搜索、刷新后链上收藏、打赏后精确余额变化、归档与手机无横向溢出。输出 qa-hub/ 截图和报告。

## 参考

- https://share.dyweb.sjtu.cn/ ：公开页面的课程资料共享定位，仅作为共享理念参考。
- 本项目未访问该站受登录限制的内部页面、代码或数据。

## 比赛官方提交材料

中文项目名：**创想集 AUREUM**。文案见 submission/PROJECT.md，字段清单见 submission/project.json，流程与当前阻塞项见 submission/OFFICIAL-WORKFLOW.md。

```sh
npm run submission:screenshots
npm run submission:check
```

截图命令默认连接正在运行的本地演示，输出两张 1600×1100 横屏图。公共测试网上线后，可执行 npm run submission:screenshots -- https://真实演示地址 重新取图。检查脚本验证必填字段、图片比例、合约配置、公开网址响应和验证记录，输出 submission/readiness.json。它不会替代人工核验最终链上验证状态，也不会在缺少比赛 Agent 指引时猜测注册或提交接口。

官方开发文档：https://docs.monad.xyz/developer-essentials ，测试网信息：https://docs.monad.xyz/developer-essentials/testnet ，部署概要：https://docs.monad.xyz/developer-essentials/summary 。
