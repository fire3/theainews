---
title: "ECC：把编码智能体装进一套工程操作系统"
description: "开源项目 ECC 用 71 个子智能体、311 个技能与强制流程，让 Claude Code、Codex 等编码智能体先计划、再测试、后复查，并跨工具共享记忆。"
pubDate: 2026-10-26
author: "林晓"
category: "tools"
tags: ["ECC", "智能体", "Claude Code", "Codex", "TDD", "开发工具", "开源"]
image: "/covers/2026-10-26-ecc.jpg"
imageAlt: "封面：工程蓝图风，左侧为标题「ECC：智能体的工程操作系统」与副标题「71 个子智能体，311 个技能，28.9 万 Star」，右侧为抽象的四段流水线与节点图"
topStory: true
---

截至 10 月 26 日，GitHub 开源项目 <strong>ECC</strong> 已获得约 28.9 万 star、4.28 万 fork。它由独立开发者 affaan-m 维护，采用 MIT 许可，最新版本为 10 月 1 日发布的 2.2.3。ECC 的定位不是另一个编码模型，也不是新的 IDE，而是给 Claude Code、Codex、Cursor 等「智能体外壳（harness）」补上一套工程流程：先计划，再写测试，随后实现、复查、验证，最后把经验沉淀下来。

这个项目的自我描述是「智能体外壳性能优化系统」。README 用一条流水线概括它的目标：

```text
plan -> test -> implement -> review -> verify -> remember -> improve
```

换句话说，它试图解决的不是「模型会不会写代码」，而是「模型能否稳定地按团队流程交付代码」。

## 从会写代码到按流程交付

ECC 的核心主张是：计划不应该消失在聊天记录里，测试也不应该只是一句可能被遗忘的提示词。它把几个环节做成了可检查的产物。

开发者先通过 `/ecc:plan` 生成可编辑的实施蓝图，确认后再进入 `tdd-workflow`。流程要求先写出失败测试并留下 RED（失败）证据，再实现到 GREEN（通过），然后由一个新的上下文中的审查智能体检查回归与盲点。最终交付的不只是代码，还包括计划、失败测试、通过测试、审查发现和构建验证记录。

README 给出的对比如下：没有这套系统时，同一段上下文既写代码又审代码；有了 ECC，审查者从全新上下文进入，更容易发现原作者忽略的问题。钩子（hooks）则在模型上下文之外运行确定性检查，减少「提醒了但模型没照做」的情况。

## 五类组件，各自管理上下文

ECC 把能力拆成不同层次，而不是把所有内容一次性塞进系统提示词。仓库实际包含 71 个智能体文件、311 个 `SKILL.md` 技能文件和 97 个命令入口。

| 组件 | 数量 | 作用 | 上下文行为 |
| --- | ---: | --- | --- |
| 子智能体（Agents） | 71 | 规划、审查、构建修复、安全、架构与领域任务 | 独立上下文与工具权限 |
| 技能（Skills） | 311 | TDD、研究、安全、文档、前端、数据、ML、运维等流程 | 按任务需要加载 |
| 命令（Commands） | 97 | 兼容与快捷入口，逐步迁移到技能优先 | 调用时进入 |
| 规则（Rules） | 按语言选择 | 项目或语言的长期标准 | 常驻加载，因此需选择性安装 |
| 钩子（Hooks） | — | 在工具事件上执行检查与自动化 | 在模型上下文之外运行 |

此外还有「直觉（instincts）」：从真实会话中提取的模式，带置信度评分，在相关任务出现时被召回。ECC 的原则可以概括为一句写在 README 里的话：<strong>「Optimize the context window. Persist everything else.」</strong>（优化上下文窗口，其余一切持久化。）

## 跨工具：Claude Code 最完整，其他仍是适配层

ECC 最早围绕 Claude Code 构建，目前 Claude Code 仍是功能最完整的目标。Codex 与 Qoder 有原生插件路径；Cursor、OpenCode 处于 beta 适配；GitHub Copilot Chat 只提供指令文件，Copilot CLI 提供技能与部分智能体；Gemini、Zed、Antigravity、Qwen、Kimi 等则是实验性或最小适配。

项目自己也明确提示「不要把能力状态当成营销分级」：不同 harness 的钩子、智能体和技能 API 并不一致，不能假设功能完全对等。比如 Codex 的原生钩子需要显式信任决定，Cursor 的智能体发现机制随版本变化，Copilot Chat 则没有移植 ECC 的钩子。

跨工具共享记忆是另一条主线。ECC 的 Memory Vault 使用本地、可检查的 Markdown 文档保存项目记忆与交接信息，项目级数据放在 `.ecc/memory/`，用户级数据放在 `~/.ecc/memory/`。它明确把记忆视为「未经审查的上下文」，而不是可执行策略，要求智能体对关键结论回到权威来源核实。

## 省 token，也把配置当攻击面

ECC 的另一部分工作是控制成本。它建议大多数任务默认使用 Sonnet 而非 Opus，把自动压缩阈值从 95% 提前到 50%，并限制同时启用的 MCP 数量：每个 MCP 的工具描述都占用上下文，README 警告同时开启过多 MCP 可能把 20 万 token 的窗口压到约 7 万。

安全方面，ECC 把智能体配置本身视为攻击面。内置的 AgentShield 会扫描提示词、钩子、MCP 配置、权限、密钥和智能体文件；GateGuard 在破坏性 shell 命令执行前拦截，包括 `rm`、强制或带路径的 `git checkout`，以及破坏性的 `find -exec`。项目还单独发布了 `ecc-agentshield` npm 包与 GitHub Action。

需要留意的是，ECC 并非 Anthropic 官方项目，而是一个社区维护的庞大配置集合。README 专门警告只从官方仓库、npm 包、GitHub App、插件市场与官网安装，第三方转载或镜像不受维护，可能包含恶意代码。对于会执行 shell 命令、读取密钥、接入 MCP 的工具链，这类来源核验比 star 数量更重要。

## 核心总结

- <strong>定位</strong>：ECC 是面向编码智能体外壳的工程流程与组件库，不提供新模型，也不是 IDE
- <strong>规模</strong>：截至 10 月 26 日约 28.9 万 star、4.28 万 fork；仓库含 71 个子智能体、311 个技能、97 个命令入口
- <strong>流程</strong>：以计划、失败测试、实现、全新上下文审查、验证、记忆沉淀为主线，强调可检查的证据链
- <strong>上下文策略</strong>：技能按需加载、规则常驻、子智能体隔离上下文、钩子在模型之外运行
- <strong>跨工具</strong>：Claude Code 支持最完整，Codex 与 Qoder 有原生插件，Cursor、OpenCode、Copilot 等为有限适配
- <strong>成本与安全</strong>：提供 token 优化建议、AgentShield 配置扫描与 GateGuard 命令拦截，但安装前必须核验来源
- <strong>版本</strong>：最新版 2.2.3 于 2026 年 10 月 1 日发布，主要统一命名并修复发布流程

原文：[affaan-m/ECC](https://github.com/affaan-m/ECC)（GitHub，MIT License）

参考：

- [ECC README](https://github.com/affaan-m/ECC/blob/main/README.md)（affaan-m，2026-10-26 访问）
- [ECC v2.2.3 Release](https://github.com/affaan-m/ECC/releases/tag/v2.2.3)（GitHub Releases，2026-10-01）
- [ECC Platform Support](https://github.com/affaan-m/ECC#platform-support)（affaan-m）
- [ECC Token Optimization](https://github.com/affaan-m/ECC/blob/main/docs/token-optimization.md)（affaan-m）
- [AgentShield](https://github.com/affaan-m/agentshield)（affaan-m）
