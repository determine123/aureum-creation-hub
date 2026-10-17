# 官方流程对齐

## 已知来源

- MONSKILLS：https://skills.devnads.com/install.md （本次远程读取 TLS 失败；本地已安装技能已读取）
- Monad 开发指南：https://docs.monad.xyz/developer-essentials （已读取）
- 比赛：https://mojo.devnads.com/events/17
- 比赛 Agent 指令：https://mojo.devnads.com/api/agent/instructions/17/skill.md （本次 web、curl 和 Node fetch 均未能读取，尚不能按其中规则注册/绑定/提交）
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

- 本机 gh 报告已保存凭据无效；GitHub Connector 可读取账号 determine123，但当前工具没有创建仓库能力。本机需要用户重新认证（gh auth refresh -h github.com）后才能创建并推送新仓库。
- Monad RPC 余额读取因 ECONNRESET 失败，未独立核实用户提供的 100 MON 水龙头结果。
- 比赛 Agent 指令尚不可读，因此未进行注册、绑定、截图上传或正式提交。

本文件区分已知表单要求与尚未读取的 Agent 细则，不将本地测试视为公共上线成功。
