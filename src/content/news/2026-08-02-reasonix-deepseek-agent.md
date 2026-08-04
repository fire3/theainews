---
title: "Reasonix：为 DeepSeek 而生、越用越便宜的终端编码 Agent"
description: "围绕 DeepSeek 前缀缓存设计的开源编码 Agent：长会话缓存命中 90%+、输入成本约 1/5，单个 Go 二进制，终端/浏览器/编辑器三端通用。"
pubDate: 2026-08-02
author: "林晓"
category: "tools"
tags: ["Reasonix", "DeepSeek", "编码智能体", "开源工具", "MCP"]
image: "/covers/reasonix.png"
imageAlt: "Reasonix——为 DeepSeek 原生的终端编码 Agent"
---

大多数编码 Agent 每一轮都要为同一段不断增长的提示词付全价——会话越长，成本越高。Reasonix 反着来：它的运行循环逐字节对齐 DeepSeek 的前缀缓存，让长会话的缓存命中率保持在 90% 以上，输入 token 成本降到约五分之一，真正做到"越跑越便宜"。

Reasonix 是一个 MIT 开源的 AI 编码 Agent，专为 DeepSeek 设计，可以用在终端、浏览器和兼容 ACP 的编辑器里。整个引擎是一个无 CGO 的 Go 二进制，覆盖 macOS / Linux / Windows × amd64 / arm64，不需要安装或维护 Node 运行时。

## 核心卖点：缓存优先的运行循环

Reasonix 的招牌是 cache-first loop（缓存优先循环）。它把会话历史设计成 append-only（只追加），保证每次请求重放的提示词前缀逐字节一致——这正是 DeepSeek 字节稳定前缀缓存（byte-stable prefix cache）的理想对齐方式。结果就是：

- 每次请求只计算新增的部分，前缀从缓存重放，按约 1/5 的折扣计费
- 长会话命中率 90%+，每轮成本随会话变长而下降，而不是上升
- 官方示例中一场 18 分钟的会话，缓存命中率从 94.2% 升到 95.1%，总花费只有 \$0.043

工作原理可以概括为四步：冷启动时全部计算 → 上一轮从前缀缓存完整重放 → 只计算新请求 → 命中 90%+，每轮更便宜。

## 功能一览

| 特性 | 说明 |
|---|---|
| 缓存优先循环 | append-only 历史对齐 DeepSeek 前缀缓存，长会话 90%+ 命中、输入 token 约 1/5 计费 |
| 单个 Go 二进制 | 无 CGO、交叉编译覆盖 darwin/linux/windows × amd64/arm64，不依赖 Node |
| MCP 一等公民 | 支持 stdio、SSE、streamable HTTP，外部服务器工具以前缀合并进同一工具注册表 |
| 计划模式 + 沙箱 | `/plan` 先规划再执行，每次工具调用仍受权限与工作区沙箱约束 |
| 子智能体与技能 | 内置 explore / research / review / security-review 子智能体，Markdown 技能脚本带隔离工具 |
| 三端入口 | 全屏 TUI、`reasonix serve` 本地浏览器 UI、VS Code 扩展，或通过 `reasonix acp` 接入其他 ACP 编辑器，共用同一本地引擎 |

## 快速上手：四步开始

**第一步，安装**（macOS / Linux / Windows / WSL 通用）：

```bash
npm i -g reasonix
```

也可以用 Homebrew（macOS / Linux）：`brew install esengine/reasonix/reasonix`。

**第二步，指向你的仓库**：

```bash
cd your-project && reasonix
```

Reasonix 会一次性完成代码库测绘，然后让这份"地图"常驻在温热的前缀缓存里——后续每轮都不必重新理解项目。

**第三步，打开 Web UI**：

```bash
reasonix serve --auth token
```

本机使用保持默认即可；要通过 tunnel 或远程端口分享时，先启用 token 或密码认证。

**第四步，让它一直跑着**：排队任务、审查 diff、随时恢复——会话永远不会冷却。

## 使用形态与生态

- **桌面端**：可视化管理会话、设置、审批与自动更新，覆盖 macOS（Universal DMG）、Windows（x64/ARM64）、Linux（Debian/Ubuntu）
- **CLI / TUI**：`npm i -g reasonix` 或 Homebrew 安装，与桌面端同一套本地引擎
- **编辑器扩展**：VS Code / VSCodium 等通过扩展 `SivanLiu.reasonix-agent` 接入，扩展连接 `reasonix acp`，不内置 CLI
- **技能市场**：官网提供 Skills 页面，配合 Markdown 技能脚本使用
- **更新渠道**：Stable 与 Preview 双渠道，正式版每 1–2 天有官方签名构建；npm 与 Homebrew 跟随 Stable

隐私方面，Reasonix 使用你自己的 DeepSeek API Key，代码不会离开你的机器和模型。

## 开源共建

Reasonix 采用 MIT 许可，在 GitHub（esengine/DeepSeek-Reasonix）上开放开发，目前已获得 28,726 颗 star、合并 2,806 个 PR，共有 98 位真实贡献者参与共建，项目还标注了"good first issue"方便新手入门。

## 核心总结

- **省成本**：append-only 循环对齐 DeepSeek 字节稳定前缀缓存，长会话 90%+ 命中，输入 token 约 1/5 计费
- **轻安装**：单个 Go 二进制跨平台覆盖，无 Node 运行时依赖
- **全场景**：CLI/TUI、桌面端、本地 Web UI、VS Code 与 ACP 编辑器共用同一引擎
- **够安全**：自带 API Key、代码不出本机，计划模式与沙箱双重管控工具调用

原文：[Reasonix — DeepSeek-native coding agent for your terminal](https://reasonix.io/)
