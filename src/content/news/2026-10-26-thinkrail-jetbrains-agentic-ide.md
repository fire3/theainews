---
title: "JetBrains 开源 ThinkRail：给极简的 pi 智能体套上一个真正的 IDE"
description: "JetBrains 开源智能体 IDE ThinkRail：每个工作区是一个 git worktree，改动按轮次出收据，项目意图写进规格图，底层跑的是 pi。"
pubDate: 2026-10-26
author: "林晓"
category: "tools"
tags: ["ThinkRail", "JetBrains", "pi", "智能体 IDE", "git worktree", "规格驱动开发", "MCP", "开源"]
image: "/covers/2026-10-26-thinkrail.jpg"
imageAlt: "封面：深炭黑高对比杂志风，上方居中三行文字——白色超大英文标题「ThinkRail」、青绿中文标题「JetBrains 的智能体 IDE」与灰色小字「pi 引擎 · git worktree 工作区 · Apache-2.0」；下方三条水平平行铁轨，中间一条为青绿，每条轨上各有一枚圆角方形节点，左端折出短分叉表示独立分支"
topStory: false
---

10 月 24 日起，JetBrains 的一个开源项目在 Hacker News 上被反复讨论：<strong>ThinkRail</strong>，一个围绕编码智能体 <strong>pi</strong> 构建的「智能体 IDE」。截至发稿，讨论帖已有 221 分、165 条评论，GitHub 仓库有 2,347 star、132 fork 与 24 位贡献者，Apache-2.0 许可。它没有另造一个智能体，而是把 pi 跑在自己的进程里，再在外面补上工作区隔离、编辑器、逐轮改动审查与规格文档管理。

## 一个薄壳，而不是第二个智能体

ThinkRail 的产品文档把定位写得很直白：<strong>「pi 是唯一引擎」，在进程内运行，不做第二个运行时</strong>。模型注册表、系统提示词、技能与扩展、上下文压缩、成本统计、会话状态都归 pi；ThinkRail 只负责工作区、编辑器与两端之间的协议。官方说法是，它「绝不会在你背后拼装提示词」。

pi 是 Earendil Works 维护的极简智能体框架，MIT 许可，GitHub 上已有 11.8 万 star。它的卖点是「适配你的工作流，而不是反过来」：默认不提供子智能体与计划模式，需要什么自己装扩展。

代码结构分三环：<strong>引擎宿主</strong>（`packages/server`，Bun 的 HTTP + WebSocket 服务，每个聊天一个进程内 pi 会话）、<strong>连线</strong>（`packages/contracts`，带版本号的类型协议，是客户端与宿主之间唯一的耦合）、<strong>UI 客户端</strong>（React 19 + Zustand + Tailwind v4，可独立发布并连接任意宿主）。桌面版用 Electrobun 打包成原生窗口，命令行版 `thinkrail` 启动同一个宿主并在浏览器里打开同一套界面，状态都存在 `~/.thinkrail`。界面内置英文与简体中文，也可以往 `~/.thinkrail/locales` 丢一份翻译文件自己加语言。

值得一提的对照是 JetBrains 的另一条线：<strong>JetBrains Air</strong> 被官方描述为「用智能体构建软件的一个系统」，接入 Claude Agent、Codex、Junie 等多家智能体。ThinkRail 则是 JetBrains InnovationHub 旗下的开源实验，规模小得多，方向也更窄——把 pi 的终端工作流图形化。Hacker News 上有读者的判断是：「Air 是战略产品，ThinkRail 更像一个实验。」

## 工作区：每个任务一条 git worktree

ThinkRail 的核心隔离单位不是「项目」，而是<strong>工作区</strong>：一个项目就是任意本地 git 仓库，工作区是从中切出的 `git worktree`，有自己的分支与工作目录；文件树、改动、终端、聊天全部以它为范围。多个智能体可以并行工作而互不干扰，主分支在你合并之前保持干净。工作区默认建在 `~/.thinkrail/worktrees` 下。

两个例外被明确标为用户所有、程序不会重命名或回收：每个项目自带一个 <strong>Default 工作区</strong>（`kind: default`），指向项目文件夹本身，必须由用户主动进入；以及用户显式挂载的既有 worktree。

工作区列表也不再无限增长。PR 合并或关闭后，或者闲置 7 天（可在设置里改成 1、3、7、14 天或永不），工作区会沉到每个项目的 Settled 搁架，重新在里面操作时再浮上来。顶栏常驻显示当前分支相对 `origin` 的位置和下一步动作，并调用用户自己的 `gh` 打开或更新 GitHub PR——<strong>ThinkRail 不保存任何 GitHub token</strong>。

## 0.2.0：给每一轮改动开一张收据

10 月 18 日发布的 0.2.0 是目前稳定版（nightly 已推进到 0.3.0），最实用的变化是「审查这一轮，而不是翻聊天记录」。一轮运行若改动了文件，结尾会显示类似 `3 files changed · +27 −4` 的收据和一个 <strong>Review turn</strong> 按钮。数字并非来自智能体自报的工具调用：宿主在一轮开始与结束时各对 worktree 做一次快照，因此 shell 命令改写的文件、格式化工具、重命名都会被算进去，而 `HEAD`、索引与 reflog 不受影响。

审查也细到了 hunk：在分支差异里，每个 hunk 都有 <strong>Keep</strong>、<strong>Revert</strong> 与 <strong>Ask agent about this hunk</strong>；Keep 以 hunk 内容为键，行号漂移不会失效，但智能体再次改动该 hunk 时标记会失效。超过 400 行的改动、锁文件与生成文件默认折叠。

同一版还补上了 MCP：服务器从你的 `mcp.json` 读取，设置里提供 Context7、DeepWiki、Linear（只读）、Sentry、Playwright 预设。会改数据的调用会把参数列在工具卡片上再问你，选项包括 <strong>Always allow</strong>——但这个授权存在项目记录里，不写进 `.pi/mcp.json`，所以仓库无法自带预授权；服务器的命令或 URL 一变，授权即失效。

## 规格图：让意图活过这次会话

ThinkRail 自己是规格驱动开发的实践者，也把这套方法推给用户的项目：每个模块旁边放一份 `SPEC.md`，用 frontmatter 连成一张图（目标、架构、模块、任务），智能体通过 `spec_*` 工具读取、检索与维护，只读的 Specs 面板把它渲染成树。0.2.0 里「设计访谈」重新默认开启：每个特性、行为变更或缺陷修复都要先由智能体提问、更新规格，并展示它否决过的备选方案。

技能则直接复用生态里已有的目录：`~/.pi`、`~/.claude`、`~/.codex`、`~/.copilot`、`~/.gemini` 里的 Agent Skills 被就地读取，pi 仍然是解析器与运行时。项目自带的技能、扩展、提示词与 `SYSTEM.md`，在用户授予项目信任之前不会加载。

## 安全边界画在 pi 之外

一个容易被忽略的事实：<strong>pi 本身不提供限制文件系统、进程、网络或凭据访问的权限系统</strong>，默认以启动它的用户权限运行；其文档建议用容器或沙箱获得更强边界（Gondolin 扩展、Docker、OpenShell 三种模式）。ThinkRail 继承了这个模型，它做的是把「仓库能给智能体注入什么」管住：未信任项目的 `.pi` 资源不加载，MCP 服务器按条目批准。

凭据方面，ThinkRail 没有自己的账号体系，登录走 pi 的 provider 认证或 JetBrains AI；设置里只存引用，密钥必须是 `${VAR}` 或 `!command`，并拒绝把凭据直接粘进 URL。分析数据方面，官方声明只收集启动、建聊天、发消息、连接 provider 这类事件，不含提示词、代码、文件、凭据与账号身份；错误上报只带错误类型、代码与位置。

## 反响：认可，以及对「LLM 味」的批评

Hacker News 的讨论里，最集中的正面评价是「这正是我缺的东西」——pi 很强，但在终端里驱动它、审阅它的外围工作确实笨重；也有人认为 JetBrains 自家的 AI 集成一向难用，这个方向算一次纠正。批评同样直接：多位读者认为 README 的措辞和规格文档有浓重的「LLM 生成感」，质疑「规格是事实来源」在实际使用中是否成立；还有人质疑网页版 GUI 的价值，以及把智能体直接跑在宿主机上的安全性。

## 核心总结

- <strong>事件</strong>：JetBrains InnovationHub 开源 ThinkRail，围绕 pi 构建的智能体 IDE，Apache-2.0；仓库 7 月 8 日建立、8 月 19 日首次公开，10 月 18 日发布 0.2.0 稳定版
- <strong>数据</strong>：截至发稿 2,347 star、132 fork、24 位贡献者；Hacker News 讨论帖 221 分、165 条评论
- <strong>架构</strong>：pi 在进程内运行并独占模型、技能、压缩、成本与会话；三环为引擎宿主（Bun HTTP+WS）、版本化协议、可独立发布的 React 客户端
- <strong>隔离</strong>：项目即 git 仓库，工作区即 `git worktree`（独立分支与目录），PR 通过用户自己的 `gh` 创建，不保存 token
- <strong>审查</strong>：0.2.0 起每轮改动由宿主快照生成收据，支持按 hunk 的 Keep / Revert / 交给智能体，MCP 调用默认逐次确认
- <strong>知识</strong>：`SPEC.md` 组成的规格图由智能体的 `spec_*` 工具维护；技能复用 pi、Claude、Codex、Copilot、Gemini 的既有目录
- <strong>边界</strong>：安全模型继承 pi——没有内置权限系统，需要更强隔离时应自行容器化；凭据与分析数据有明确的最小化约定
- <strong>平台</strong>：macOS（仅 Apple Silicon）、Windows x64、Linux x64/ARM64；Linux 桌面版要求 glibc 2.38+ 与 GTK 3/WebKitGTK 4.1，也可用 CLI 在浏览器里使用

原文：[JetBrains/thinkrail](https://github.com/JetBrains/thinkrail)（JetBrains，GitHub）

参考：

- [ThinkRail 官网](https://thinkrail.ai/)
- [Introducing ThinkRail](https://thinkrail.ai/blog/introducing-thinkrail/)（ThinkRail Blog，2026-08-19）
- [ThinkRail 0.2.0: review the turn, not the chat log](https://thinkrail.ai/blog/thinkrail-0-2-0-review-the-turn/)（ThinkRail Blog，2026-10-18）
- [An agentic IDE that follows Pi's philosophy](https://thinkrail.ai/blog/thinkrail-pi-skills-and-desktop-apps/)（ThinkRail Blog，2026-10-01）
- [architecture.md 与 goal-and-requirements.md](https://github.com/JetBrains/thinkrail/blob/main/architecture.md)（ThinkRail 仓库）
- [pi](https://github.com/earendil-works/pi)（Earendil Works，MIT）
- [JetBrains Thinkrail（Hacker News 讨论）](https://news.ycombinator.com/item?id=50233294)（2026-10-25）
- [JetBrains Air](https://www.jetbrains.com/ai/)
