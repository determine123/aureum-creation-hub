# 官方流程对齐

## 已知来源

- MONSKILLS：https://skills.devnads.com/install.md （本地已安装技能已读取）
- Monad 开发指南：https://docs.monad.xyz/developer-essentials （已读取）
- 比赛：https://mojo.devnads.com/events/17
- 比赛 Agent 指令：https://mojo.devnads.com/api/agent/instructions/17/skill.md （已成功读取；正文保留于本机、未提交 Git，避免复述指令）
- 用户提供的项目提交表单：中文项目名、外部可访问演示网址、公开 GitHub 仓库、Monad Blitz 活动关联、1–5 张横屏截图、项目文档与完整 README。

## 执行顺序

1. 保留项目源码、测试与文档。运行 npm run test:hub、npm run test:hub:browser、npm run build。
2. 通过网页钱包部署 DemoToken 与 CreationHub。领取测试 MON 的地址不是合约地址，也不能提供签名权限。
3. 用 npm run configure:hub 校验链上配置；运行 npm run verify:hub 并查看最终区块浏览器验证状态。
4. 发布公开 GitHub 仓库和无需登录的 HTTPS 演示站点。不要把 localhost、私有 Sites 地址或预期 URL 填入表单。
5. 将真实 frontendUrl 与 githubUrl 写入 submission/project.json。横屏截图位于 submission/screenshots/，需与提交版本一致；公共测试网上线后重新截图。
6. 运行 npm run submission:check；所有阻塞项消除后，再用无痕浏览器走完整流程。
7. 网络恢复后重新读取 Agent 指令，按其实际返回内容注册、绑定活动并提交。不要猜测接口、伪造注册状态或绕过身份验证。

## 当前外部依赖

- GitHub 登录已恢复，公开仓库 https://github.com/determine123/aureum-creation-hub 已创建并已有源码。后续更新仍可能受间歇性 TLS 影响，需要检查实际远程提交版本。
- Monad RPC 余额读取因 ECONNRESET 失败，未独立核实用户提供的 100 MON 水龙头结果。
- Mojo Agent 已注册，用户已完成认领；GET /api/agent/me 已返回 claimedUser。密钥使用 Windows DPAPI 加密存储于当前用户的 LOCALAPPDATA/AureumBlitz，不在项目、Git 或日志中。
- 2026-10-17 已重新成功读取官方 Agent 指引；GET /api/agent/me 返回 claimed，GET /api/agent/projects?eventId=17 返回比赛 ongoing、团队赛启用（最多 3 人）、project=null。此查询未返回个人报名/签到或队长资格，提交时仍需服务器校验。尚未上传截图或正式提交，等待公共测试网合约部署与验证。
- 新部署向导为 /?deploy=1。支持 EIP-6963 多钱包发现，不再仅依赖 window.ethereum；可以选择钱包，拒签第二笔后可重试续传。当前浏览器需安装并启用钱包扩展，已通过模拟本地网络的浏览器部署验证。
- Sites 复用原 project_id，源码推送仍受 TLS 失败影响；没有创建重复站点。已改用同一公开仓库的 GitHub Pages 自动部署，Pages 已启用，构建与外部验收结果另行确认。
- GitHub Pages 已成功提供公共前端 https://determine123.github.io/aureum-creation-hub/ 。匿名浏览器验收报告为 qa-hub/public-result.json；仅前端与部署入口通过，不代表公共测试网交易已完成。

本文件区分已知表单要求与尚未读取的 Agent 细则，不将本地测试视为公共上线成功。

## 公共链核验更新

已核验并配置用户部署的 DemoToken 与旧版 CreationHub；两个合约在 Monadscan 和 Monadvision 均验证成功，记录见 deployment/testnet-audit.json 与 verification/。真实正文费用估算见 benchmarks/monad-estimates.json，不能当作成交回执。旧版没有 supportBatch；已提供复用代币、只需一笔签名部署新版 hub 的入口。新版上线与真实发布/支持验收尚未完成，提交检查保留阻塞。
