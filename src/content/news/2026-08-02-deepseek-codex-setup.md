---
title: "DeepSeek 接入 Codex 教程：一条命令，三端通用"
description: "DeepSeek 官方提供一键脚本和手动配置两种方式接入 Codex，CLI、ChatGPT 桌面端、VS Code 插件共用一份配置。"
pubDate: 2026-08-02
author: "林晓"
category: "tutorial"
tags: ["DeepSeek", "Codex", "配置教程", "AI 编程", "API"]
image: "/covers/deepseek-codex-setup.jpg"
imageAlt: "深色科技封面：左侧白色大标题 DeepSeek 接入 Codex，右侧三个设备图标通过发光数据流汇聚到中央节点，示意一份配置三端通用"
---

OpenAI 的 Codex 是当下最常用的 AI 编程助手之一，而 DeepSeek 的 API 原生兼容 Codex 所用的 Responses API 协议——这意味着你可以把 Codex 的底层模型换成 DeepSeek，用更便宜的价格获得同样的编码助手体验。DeepSeek 官方文档给出了完整的接入方法，本文把步骤整理成一份可以直接照着做的教程。

## 接入前须知

- **模型支持**：目前仅 `deepseek-v4-flash` 支持接入 Codex；`deepseek-v4-pro` 预计 2026 年 8 月初支持
- **配置通用**：Codex CLI、ChatGPT 桌面端、VS Code 的 Codex 插件（Codex IDE extension）共用同一份配置文件，配置一次即可在所有形态下使用 DeepSeek 模型
- **准备工作**：安装 Codex CLI 或 ChatGPT 桌面端，并至少运行过一次（确保 `~/.codex` 目录存在）；准备好以 `sk-` 开头的 API Key（在 DeepSeek Platform 的 API Keys 页面获取）

## 方式一：一键配置脚本（推荐）

DeepSeek 官方提供了一键配置脚本，自动完成全部配置工作。

macOS / Linux 在终端执行：

```bash
bash <(curl -fsSL https://cdn.deepseek.com/api-docs/codex-deepseek-setup.sh)
```

Windows 在 PowerShell 执行：

```powershell
irm https://cdn.deepseek.com/api-docs/codex-deepseek-setup-en.ps1 | iex
```

运行后按菜单选择要使用的模型，首次运行会提示输入 API Key。脚本会依次完成：

1. **备份现有配置**：把 `~/.codex/config.toml` 备份到 `~/.codex/backup-deepseek/`，随时可以还原
2. **写入模型目录**：创建 `~/.codex/models.json`，向 Codex 声明 DeepSeek 模型的元数据（上下文窗口长度、支持的推理强度档位、工具调用格式等），让 Codex 能像使用内置模型一样使用 DeepSeek 模型
3. **修改 `config.toml`**：只改写必要字段，并新增 `[model_providers.deepseek]` 配置段；你原有的 MCP 服务器、项目信任级别等配置全部保留。若存在冲突字段，脚本会删除它们并逐条打印删除原因
4. **校验**：写入前校验 `config.toml` 和 `models.json` 语法合法，校验失败则中止，不修改任何文件

再次运行脚本，可以在菜单里切换模型，或者恢复到安装前的默认配置（菜单第 3 项）。

## 方式二：手动编辑配置文件

如果你偏好自己掌控每一步，可以手动创建/修改两个文件。

首先是模型目录文件 `~/.codex/models.json`，向 Codex 声明 DeepSeek 模型的元数据。文件包含 `deepseek-v4-flash` 与 `deepseek-v4-pro` 两个模型条目，关键元数据包括：上下文窗口 1,048,576 tokens、支持的推理强度档位（low/high/max）、工具调用格式、`prefer_websockets`、`supports_parallel_tool_calls` 等（完整内容见官方文档，与一键脚本写入的内容一致）。

然后是 `~/.codex/config.toml`，需要设置以下字段：

| 字段 | 作用 |
|---|---|
| `model` | 默认使用的模型 |
| `model_provider` | 使用的模型提供方，对应 `[model_providers.<id>]` 的 id |
| `preferred_auth_method`、`forced_login_method` | 使用 API Key 认证，跳过 ChatGPT 账号登录 |
| `model_reasoning_effort` | 推理强度；值越高思考越深入、回答质量越高、耗时越长 |
| `model_catalog_json` | 自定义模型目录文件（`models.json`）的路径 |
| `[model_providers.deepseek]` 的 `name` | 模型提供方的显示名称 |
| `[model_providers.deepseek]` 的 `base_url` | DeepSeek API 的接口地址 |
| `[model_providers.deepseek]` 的 `wire_api` | 与模型通信的协议，`"responses"` 表示 Responses API |
| `[model_providers.deepseek]` 的 `experimental_bearer_token` | 你的 API Key，直接写在配置文件里 |

## 开始使用：三端验证

配置完成后，三种客户端都会读取同一份配置，无需分别设置：

- **Codex CLI**：进入项目目录执行 `codex`。启动信息中显示 `model: deepseek-v4-flash`（或你选择的模型）即为生效
- **ChatGPT 桌面端**：Mac 端模型选择器中显示「自定义」即为生效；Windows 端可能显示「自定义」或「DeepSeek-V4-Flash」，显示「自定义」时实际使用的就是你选择的 DeepSeek 模型
- **VS Code 的 Codex 插件**：与 CLI 共用同一份配置，安装插件后即可直接使用

## 切换提供方后的历史会话

切换到 DeepSeek 后如果发现之前的历史会话"不见了"，不用担心——它们并没有被删除。Codex 会按登录方式分组存放会话：ChatGPT 官方订阅产生的会话与第三方 API（如 DeepSeek）产生的会话分属两组，界面上只显示与当前配置匹配的一组。恢复原配置（例如一键脚本菜单第 3 项）即可重新看到之前的会话，此时 DeepSeek 的会话会被隐藏。注意：切换后需重启 ChatGPT 客户端才会生效。

## 核心总结

- **一条命令**：macOS/Linux 和 Windows 都有官方一键脚本，自动备份、写配置、校验，出错可一键还原
- **手动可控**：`models.json` 声明模型元数据，`config.toml` 指定提供方、base_url、Responses API 协议与 API Key
- **三端通用**：CLI、ChatGPT 桌面端、VS Code 插件共用一份配置，配置一次处处可用
- **当前限制**：仅 `deepseek-v4-flash` 可用，`deepseek-v4-pro` 预计 8 月初支持

原文：[接入 Codex | DeepSeek API Docs](https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/codex/)
