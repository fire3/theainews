---
title: "Agent Client Protocol 一年：42 款编程智能体接入，编辑器与智能体正在解耦"
description: "ACP 让编程智能体和编辑器通过一套 JSON-RPC 协议互相适配。发布一年后注册表已有 42 款智能体，v1 与 SDK 稳定，远程接入仍在进行中。"
pubDate: 2026-10-18
author: "林晓"
category: "industry"
tags: ["Agent Client Protocol", "ACP", "AI 编程智能体", "Zed", "JetBrains", "IDE", "互操作标准", "LSP"]
image: "/covers/2026-10-18-agent-client-protocol-explainer.jpg"
imageAlt: "封面：白底配深藏蓝分栏的商务风，左栏标题「一个协议，所有编辑器」与副标题「Agent Client Protocol · 42 款智能体接入」，右栏为多个编辑器方块经金色连线汇入一个智能体节点"
topStory: false
---

截至 10 月 18 日，Agent Client Protocol（ACP）官方注册表列出 <strong>42 款</strong>可直接安装的编程智能体——从 Gemini CLI、Cursor、GitHub Copilot CLI，到 Kimi CLI、Qwen Code、Devin、Mistral Vibe。它们共同遵循一套由 Zed 发起、JetBrains 参与共建的开放协议，使同一款智能体可以跑在任意支持 ACP 的编辑器里。

这个项目发布于 2025 年 8 月，由 Zed 与 Google Gemini CLI 团队共同宣布，Gemini CLI 是第一个参考实现。一年之后，它已经从「Zed 的一个内置功能」变成了一个跨编辑器的分发标准：v1 规范稳定，Rust 与 TypeScript SDK 在 6 月 25 日到达 1.0，注册表以每小时一次的频率自动同步版本。

先澄清一个常见的命名混淆：**ACP 在 2026 年至少指三个不同的东西**——本文讨论的 Agent Client Protocol；IBM/BeeAI 的 Agent Communication Protocol（已于 2025 年并入 A2A）；以及支付领域的 Agentic Commerce Protocol。中文技术圈讨论「ACP」时，绝大多数语境指的是第一个。

## 一个 N×M 问题

ACP 的自我定位非常明确：<strong>给编程智能体做一个 LSP</strong>。LSP（Language Server Protocol）当年解决的是编辑器与语言服务器之间的 N×M 集成问题，ACP 把它照搬到了编辑器与智能体之间。

官方文档列出的四个动机是：集成成本、兼容性受限、开发者锁定，以及每家各自造轮子的负担。原文的说法是：<strong>「实现了 ACP 的智能体可以配合任何兼容的编辑器工作。」</strong>

在 ACP 之前，一个智能体想进 Zed、JetBrains、Neovim，就得分别写适配。对智能体厂商来说这是纯成本，对编辑器来说也是——每接一款智能体都要单独开发一遍。ACP 把这件事拆成两边：智能体实现一次 ACP server，客户端实现一次 ACP client。

值得一提的是，ACP 的客户端并不限于编辑器。AgentRQ 就把自己的任务看板做成了 ACP 客户端，用于把看板上的任务分发给智能体——这说明协议抽象出来的是「谁在监督智能体」，而不只是「哪个编辑器在承载它」。

## 协议里到底有什么

ACP 基于 <strong>JSON-RPC 2.0</strong>，本地运行时智能体作为编辑器的子进程，通过 stdio 通信；远程模式规划了 HTTP 与 WebSocket，但目前尚未定稿。协议里的核心流程可以概括成四步：

1. `initialize`：双方协商协议版本，并交换能力声明（能否读取会话、能否读写文件、能否开终端）
2. `session/new`：创建会话；`session/load` 可以恢复历史会话
3. `session/prompt`：客户端发来一条用户输入，智能体开始工作
4. `session/update`：智能体持续推送消息片段、工具调用、计划、模式切换等进度

整个过程中，两个客户端方法最关键：

- `session/request_permission`：智能体要做有副作用的操作时，必须向客户端申请授权
- `fs/read_text_file`、`fs/write_text_file`、`terminal/create` 等：由客户端代为读写文件和执行命令，均为能力门控（capability-gated）

这套设计带来一个实际差别：<strong>权限提示、diff 视图、终端输出都由编辑器渲染</strong>。智能体不再自带一层终端界面，而是把「做了什么」作为结构化事件交给客户端，客户端可以用原生 UI 展示。安全边界也留在客户端一侧，由它决定允不允许读某个目录、跑某条命令。

协议还刻意复用了 MCP 的 JSON 表示，文本默认按 Markdown 处理。ACP 不取代 MCP：MCP 负责智能体与工具、数据源的连接，ACP 负责智能体与用户所在界面之间的连接。

## 注册表：42 款，原生多于适配

注册表（`agentclientprotocol/registry`）是 2026 年初上线的分发层：开发者提交一次，所有支持 ACP 的客户端都能浏览、安装并自动更新。Zed 称其目标是「实现一次，处处可用」，JetBrains 参与了注册表规范的制定。

它的工程细节也说明了这套体系已经相当认真：仓库要求接入智能体必须支持用户登录，CI 会校验 ACP 握手阶段是否返回有效的 `authMethods`；每小时运行一次的定时任务会检查 npm、PyPI 与 GitHub Release，自动把版本更新直接提交到 `main`；索引同时提供通用版、JetBrains 专用版和一个预览通道。

按 10 月 2 日 AgentRQ 的整理，ACP 支持可以分成两类：

| 接入方式 | 含义 | 代表 |
|---|---|---|
| 原生 | 智能体厂商自己内置 ACP 模式 | Gemini CLI（`gemini --acp`）、Cursor（`cursor-agent acp`）、OpenCode、GitHub Copilot CLI、Qwen Code、Cline、goose、Junie、Kimi CLI、Devin |
| 适配器 | 由外部程序包装一个不支持 ACP 的智能体 | Claude Code（`claude-acp`）、Codex（`codex-acp`）、Amp、Pi |

一个反直觉的事实是：<strong>体量最大的两款智能体——Claude Code 与 Codex——走的都是适配器路线</strong>，由 ACP 项目维护包装层；而 Gemini CLI、Cursor 这些厂商则选择了原生支持。对用户来说两种方式都能用，但适配器意味着多一个进程、多一层缓冲，能力更新会比原版滞后。

## 这一年补齐了什么

ACP 在 2026 年的主要工作不是加新概念，而是把 v1 里零散的能力逐项稳定下来：

| 时间 | 进展 |
|---|---|
| 2025-08 | Zed 与 Gemini CLI 团队发布 ACP |
| 2025-10 | JetBrains 加入共建 |
| 2026 年初 | ACP Registry 上线（Zed 1 月 28 日宣布，官方更新日志 3 月 9 日记录发布） |
| 2026-02 | 会话配置项（模型、模式、推理等级）稳定 |
| 2026-04 | 会话恢复稳定；成立传输工作组 |
| 2026-06 | Rust 与 TypeScript SDK 到达 1.0；用量上报、请求取消稳定 |
| 2026-07 | v2 草案发布；elicitation 交互稳定 |
| 2026-09 | 工具调用名称稳定 |

治理层面也在变化：JetBrains 的 Sergey Ignatov 在 2 月成为 ACP 的 Lead Maintainer，JetBrains 的 Anna Zhdan 与 Goose 团队的 Alex Hancock 共同牵头传输工作组。协议从 Zed 一家主导，转向多家 IDE 与智能体厂商共同维护。

## 还没解决的两件事

<strong>第一，远程智能体还没有完成。</strong>ACP 目前实质上是「本地机器协议」：智能体作为编辑器子进程通过 stdio 通信。官方文档明确写着远程支持「仍在进行中」。4 月 22 日成立的传输工作组已经提出 Streamable HTTP 与 WebSocket 的草案请求（RFD），Rust SDK 里也有 `agent-client-protocol-http` 在提供 HTTP/SSE 与可选的 WebSocket 传输，但规范本身尚未定稿。这意味着云端托管智能体、多机协作这类场景，暂时还不能直接建立在 ACP 标准之上。

<strong>第二，兼容不等于一致。</strong>ACP 有意做得宽松，各家在换模型、会话恢复、子智能体展示等能力上并不一致，客户端只能按能力声明「尽力而为」。同一款智能体在 Zed 与 JetBrains 里的行为，仍可能存在差异。协议统一的是连接方式，不是智能体的行为语义。

此外，适配器路线的滞后风险也值得留意：Claude Code 与 Codex 的新能力，要先等 ACP 适配器跟进，编辑器用户才能用上。这也是原生支持的价值所在——协议本身很薄，真正的体验差异来自各家的实现质量。

## 为什么这值得关注

ACP 的走红不是因为它提供了新能力，而是因为它把一件重复劳动变成了公共基础设施。对编辑器来说，竞争焦点从「支持了哪几款智能体」转向编辑体验本身；对智能体厂商来说，IDE 渠道的分发成本大幅下降，小团队也能进入 JetBrains 与 Zed 的用户视野。

但与 LSP 相比，它离「事实标准」还有距离：LSP 面对的是语言服务器这种相对稳定的对象，而智能体的行为、权限模型、会话模型都还在快速变化，v2 草案与远程传输同时推进就是这种压力的体现。注册表能否持续增长、适配器能否跟上主线，比任何一次发布公告都更能说明 ACP 的长期位置。

## 核心总结

- <strong>ACP 是什么</strong>：Zed 发起、JetBrains 共建的编辑器与编程智能体之间的开放协议，定位是「智能体界的 LSP」
- <strong>技术形态</strong>：JSON-RPC 2.0，本地走 stdio 子进程；会话、提示、流式更新、权限申请是核心原语
- <strong>关键设计</strong>：文件读写与终端操作由客户端代为执行并受权限控制，diff 与审批提示由编辑器渲染
- <strong>生态现状</strong>：官方注册表共 42 款智能体；Gemini CLI、Cursor、Copilot CLI、Qwen Code 等原生支持，Claude Code 与 Codex 依赖 ACP 项目维护的适配器
- <strong>标准进展</strong>：v1 稳定，SDK 1.0，v2 草案；远程传输（HTTP/WebSocket）仍在草案阶段
- <strong>仍存问题</strong>：远程智能体未完成、各家行为不一致、适配器存在滞后
- <strong>与相邻协议的分工</strong>：MCP 连接工具与数据，ACP 连接用户界面，A2A 负责智能体之间的任务委派

参考：

- [ACP 官方文档：协议总览](https://agentclientprotocol.com/protocol/overview)（Agent Client Protocol）
- [ACP 更新日志](https://agentclientprotocol.com/updates.md)（Agent Client Protocol）
- [The ACP Registry is Live](https://zed.dev/blog/acp-registry)（Zed Blog，2026-01-28）
- [ACP Registry 仓库](https://github.com/agentclientprotocol/registry)（GitHub）
- [Which Coding Agents Support ACP?](https://agentrq.com/blog/which-coding-agents-support-acp-agent-client-protocol)（AgentRQ Blog，2026-10-02）
- [Transports Working Group](https://agentclientprotocol.com/announcements/transports-working-group)（Agent Client Protocol，2026-04-22）
- [JetBrains × Zed: Open Interoperability for AI Coding Agents](https://blog.jetbrains.com/ai/2025/10/jetbrains-zed-open-interoperability-for-ai-coding-agents-in-your-ide/)（JetBrains Blog，2025-10）
