---
title: "编程智能体接管已登录 Chrome：六种方案的原理、配置与取舍"
description: "Claude Code、Codex、Gemini CLI、Cursor 如何使用你日常已登录的 Chrome？对比 Claude in Chrome、Playwright MCP、Chrome DevTools MCP、Browser Harness 等六种方案的配置与安全边界。"
pubDate: 2026-10-26
author: "林晓"
category: "tutorial"
tags: ["编程智能体", "MCP", "Chrome", "Claude Code", "Gemini CLI", "Codex", "Cursor", "浏览器自动化"]
image: "/covers/2026-10-26-coding-agent-logged-in-chrome.jpg"
imageAlt: "封面：暖米白手绘教育风，左栏为手写感墨褐粗体标题「智能体接管你的 Chrome」、暖橙副标题「扩展交接 / 远程调试 · Chrome 144+」与三条要点「Claude in Chrome」「Playwright MCP」「Browser Harness」；右侧一只手绘小机器人握着暖橙钥匙，用草绿虚线连向一个手绘 Chrome 浏览器窗口，窗口标签页有暖橙高亮，下方信封、购物车、放大镜三个简笔图标"
topStory: false
---

编程智能体（Claude Code、Codex、Gemini CLI、Cursor 等）要操作网页时，常见做法是自己启动一个全新的自动化浏览器——代价是那个浏览器里没有任何登录态，遇到需要登录的网站就得从头注册、输密码、过两步验证。Browser Use 联合创始人兼 CTO Gregor Zunic 在 10 月 25 日发布的指南中给出了另一条路：<strong>让智能体直接接入你日常使用的、已登录的 Chrome</strong>，通过安装扩展把标签页交给它，或打开 Chrome 的远程调试开关让工具附着到现有浏览器上。

需要注意的是，本文作者所在的 Browser Use 正是其中一款工具 Browser Harness 的开发方，文中对其余工具的介绍基于各自官方文档与 README（核对时间为 2026 年 10 月 25 日）。以下按方案逐一展开。

## 为什么不该把 Cookie 复制进一个新浏览器

最直觉的思路是导出 Cookie、在自动化浏览器里加载（例如 Playwright MCP 的 `--storage-state`，可从文件加载 Cookie 与 localStorage 到隔离的浏览器上下文）。但全新自动化浏览器本质是<strong>另一台设备</strong>，在以下场景会失败：

- <strong>会话绑定设备</strong>：Chrome 的 Device Bound Session Credentials（DBSC）机制把私钥保存在 TPM 等安全硬件里，站点的短期会话 Cookie 过期后，Chrome 只有证明持有该私钥才能刷新。复制出去的 Cookie 在这类站点上会过期且无法续期。
- <strong>需要重新登录</strong>：新配置文件一切登出，每个登录和两步验证都要重做；Chrome DevTools MCP 文档还提醒，部分账号会阻止被 WebDriver 控制的浏览器登录。
- <strong>老办法已被封堵</strong>：自 Chrome 136 起，`--remote-debugging-port` 与 `--remote-debugging-pipe` 在默认数据目录上被忽略，必须配合 `--user-data-dir` 指向别处——Google 因攻击者借此窃取 Cookie 而收紧了这一行为。

因此下述方案全部工作在<strong>真实浏览器</strong>里，登录态、设备校验与两步验证都留在原地。

## 方案一：Claude in Chrome（仅 Claude Code）

Anthropic 的 Chrome 扩展，Claude Code 可从 CLI 或 VS Code 扩展连接。

- **配置**：安装 Chrome 应用商店的 Claude 扩展（1.0.36+），在 Claude Code 中 `/login` 登录后运行 `claude --chrome`；`/chrome` 可检查连接或设为默认。
- **是否你的 Chrome**：是。Claude 在一个标签页组中开新标签，共享浏览器登录态，在可见窗口中工作。
- **限制**：仅支持 Anthropic 直订的 Pro、Max、Team、Enterprise 计划；API key、`claude setup-token`、Amazon Bedrock、Google Cloud Agent Platform、Microsoft Foundry 以及 WSL 环境下均不可用。遇到登录页与验证码会暂停交由用户处理。

适合只用 Claude Code 且已有付费计划的用户。

## 方案二：Playwright MCP 扩展模式（任意 MCP 客户端）

微软的 Playwright MCP 默认自带浏览器与按工作区隔离的持久配置；加上 `--extension` 参数后，它改由 Playwright 扩展连接到你正在运行的 Chrome 或 Edge：

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--extension"]
    }
  }
}
```

- **是否你的 Chrome**：是，但仅限你选定的标签页。首次使用时会打开一个页面让你挑选连接哪个标签组；多个客户端可同时连接，各自只能看到自己标签组内的标签页。
- **限制**：每次连接需手动批准，除非把扩展中的 `PLAYWRIGHT_MCP_EXTENSION_TOKEN` 配到服务端 `env`；仅支持 Chrome 与 Edge。

适合<strong>希望把智能体限制在指定标签页</strong>的场景。免费，Apache-2.0 许可。

## 方案三：Chrome DevTools MCP 自动连接模式（任意 MCP 客户端）

谷歌的 Chrome DevTools MCP 以调试见长（性能 trace、网络请求、控制台输出）。Chrome 144 起，`--autoConnect` 可让它附着到你已运行的 Chrome：

```json
{
  "mcpServers": {
    "chrome-devtools": {
      "command": "npx",
      "args": ["chrome-devtools-mcp@latest", "--autoConnect"]
    }
  }
}
```

- **配置前提**：先在 Chrome 打开 `chrome://inspect/#remote-debugging` 打开远程调试开关；连接时 Chrome 会弹窗请求允许，运行期间显示「Chrome 正被自动化测试软件控制」横幅。
- **是否你的 Chrome**：是。多配置文件场景下连接默认配置文件，可见该配置文件的所有打开窗口。
- **限制**：需自行启动 Chrome；旧的 `--browser-url=http://127.0.0.1:9222` 路线要求独立 `--user-data-dir`，属于单独配置文件而非日常配置。谷歌默认收集使用统计，可用 `--no-usage-statistics` 关闭。

适合<strong>用自己的登录态调试自己应用</strong>的场景。免费，Apache-2.0。

## 方案四：Gemini CLI 内置浏览器智能体

Gemini CLI 自带浏览器子智能体，内部运行一个捆绑的 Chrome DevTools MCP。默认关闭，在 `settings.json` 中开启并把会话模式设为 `"existing"`：

```json
{
  "agents": {
    "overrides": { "browser_agent": { "enabled": true } },
    "browser": { "sessionMode": "existing" }
  }
}
```

- **是否你的 Chrome**：仅 `"existing"` 模式附着到运行中的 Chrome；默认的 `"persistent"` 模式会在 `~/.gemini/cli-browser-profile/` 下用自带配置文件启动 Chrome。
- **限制**：表单填写一律需确认；`allowedDomains` 可限定可访问域名，`maxActionsPerTask` 默认 100 次工具调用后停止；首次使用弹出同意对话框。

已在用 Gemini CLI 的话无需额外安装。

## 方案五：ChatGPT 桌面应用中的 Codex

OpenAI 的 ChatGPT 浏览器扩展让桌面应用中的 Codex 与 Work 对话使用你的 Chrome、Edge、Brave、Opera 或 Vivaldi。在桌面应用「设置 > Computer Use」中选择安装，然后在对话里用 @ 提及指定浏览器。

- **是否你的 Chrome**：是，即安装了扩展的那个浏览器配置文件。
- **限制**：默认对每个新网站操作前询问，可选择允许一次、该站点或所有站点（最后一种被 OpenAI 标注为「Elevated Risk」）。文档只覆盖桌面应用，未提及 Codex CLI——CLI 用户需改用 Browser Harness 或 MCP 方案。

## 方案六：Browser Harness（跨智能体，开源）

Browser Use 的开源工具（MIT），通过 Chrome DevTools Protocol 附着到运行中的 Chrome。Claude Code 与 Codex 以命令行工具加 skill 的方式使用它，期间智能体可以自行补写缺失的辅助代码；Cursor、Gemini CLI 等 MCP 客户端则通过 `browser-harness-mcp` 获得一组固定的 `browser_*` 工具。配置方式是把 README 中的 setup prompt 粘贴给智能体（它会用 `uv` 安装并注册 skill），再在 `chrome://inspect/#remote-debugging` 勾选一次允许远程调试。

- **是否你的 Chrome**：是，整个浏览器及其标签页与登录态；被控制的标签页标题会加上马头 emoji 以便识别，且在后台工作，不影响你当前可见标签页。
- **限制**：可见整个 Chrome 而非限定标签页或站点；需 Chrome 144+；默认发送使用遥测（包括智能体管道传入的代码及其输出），`browser-harness telemetry disable` 一条命令关闭。

适合需要<strong>在 Claude Code、Codex、Gemini CLI、Cursor 之间复用同一工具</strong>、且不希望绑定某个订阅计划的用户。

## 横向对比

| 方案 | 适用智能体 | 是否你的真实登录 Chrome | 配置要点 | 成本/许可 |
|---|---|---|---|---|
| Claude in Chrome | Claude Code | 是（标签页组） | 扩展 + `claude --chrome` | 需 Pro/Max/Team/Enterprise 订阅 |
| Playwright MCP 扩展模式 | 任意 MCP 客户端 | 是（你选定的标签页） | Playwright 扩展 + `--extension` | 免费，Apache-2.0 |
| Chrome DevTools MCP | 任意 MCP 客户端 | 是（自动连接模式） | Chrome 远程调试开关 + `--autoConnect` | 免费，Apache-2.0；需 Chrome 144+ |
| Gemini CLI 浏览器智能体 | Gemini CLI | 是（`"existing"` 模式） | settings.json + 远程调试开关 | 内置，Apache-2.0 |
| ChatGPT 浏览器扩展 | 桌面应用中的 Codex | 是（安装扩展的配置文件） | 设置 > Computer Use > 安装 | 文档未说明 |
| Browser Harness | Claude Code、Codex；其余经 MCP | 是（整个浏览器） | setup prompt + 远程调试开关 | 免费，MIT；需 Chrome 144+ |

各智能体的常用配置命令：

```bash
# Claude Code
claude --chrome
claude mcp add playwright-extension -- npx @playwright/mcp@latest --extension
claude mcp add chrome-devtools --scope user -- npx chrome-devtools-mcp@latest --autoConnect

# Codex CLI
codex mcp add playwright-extension -- npx @playwright/mcp@latest --extension
codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest --autoConnect

# Gemini CLI
gemini mcp add browser-harness uvx -- --from "browser-harness[mcp]" browser-harness-mcp
```

Cursor 则把对应 JSON 块写入 `.cursor/mcp.json` 的 `mcpServers`。注意 Cursor 内置的 Browser 虽然零配置可用，但<strong>按工作区保存自己的 Cookie，并不共享你的 Chrome 登录态</strong>。

## 安全边界：智能体在你的登录态里能做一切你能做的事

- <strong>提示注入是首要风险</strong>。Anthropic 称其为「浏览器使用型 AI 工具面临的最大风险」：藏在网页、邮件或文档中的指令可能诱使智能体执行非预期操作。Anthropic 称在 Claude Opus 4.8 及现有防御下内部测试攻击成功率低于 0.08%，但风险不为零；OpenAI 则要求把页面内容视为不可信数据。
- <strong>尽量使用独立 Chrome 配置文件</strong>：不放银行、医疗、政务等敏感账号；扩展只装在该配置文件中，Playwright MCP 可用 `--profile-dir-name` 指定配置文件；而附着整个浏览器的方案（Chrome DevTools MCP、Browser Harness）能看到该 Chrome 的所有内容，敏感账号应留在未被附着的浏览器里。
- <strong>用完关掉远程调试</strong>：手动端口模式下，机器上任何程序都可连接该端口控制浏览器；Chrome 144+ 的开关模式每次连接会弹窗确认，更安全。
- <strong>邮件与支付站点保留人工审批</strong>：发送、支付、删除类操作不要关闭确认提示。

## 核心总结

- 让智能体使用你已登录的 Chrome 有两条技术路线：<strong>浏览器扩展交接标签页</strong>（Claude in Chrome、Playwright MCP 扩展模式、ChatGPT 扩展）与<strong>远程调试附着整个浏览器</strong>（Chrome DevTools MCP、Gemini CLI `"existing"` 模式、Browser Harness）；后者普遍要求 Chrome 144+ 并需一次弹窗授权。
- 复制 Cookie 到新浏览器是下策：DBSC 设备绑定会话、WebDriver 登录拦截、Chrome 136 起默认数据目录禁用调试端口，三重原因让这条路越来越窄。
- 选择依据很简单：只用 Claude Code 且有订阅选 Claude in Chrome；要限定标签页选 Playwright MCP 扩展模式；调试自己应用选 Chrome DevTools MCP；Gemini CLI 用户直接开启内置智能体；跨智能体通用则用 Browser Harness。
- 安全默认值：独立配置文件、敏感账号隔离、保留支付/邮件操作的确认提示、用完关闭远程调试。

参考：

- [How to Let Your Coding Agent Use Your Logged-In Chrome (2026)](https://browser-use.com/posts/coding-agent-logged-in-chrome)（Browser Use，2026-10-25）
- [Chrome in Claude Code](https://code.claude.com/docs/en/chrome)（Anthropic 文档）
- [Playwright MCP](https://github.com/microsoft/playwright-mcp)（Microsoft）
- [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp)（Google）
- [Gemini CLI Subagents](https://geminicli.com/docs/core/subagents/)（Gemini CLI 文档）
- [ChatGPT 浏览器扩展](https://learn.chatgpt.com/docs/chrome-extension)（OpenAI）
- [Browser Harness](https://github.com/browser-use/browser-harness)（Browser Use，MIT）
- [Remote debugging port disabled by default](https://developer.chrome.com/blog/remote-debugging-port)（Chrome 开发者博客，2025-03-17）
