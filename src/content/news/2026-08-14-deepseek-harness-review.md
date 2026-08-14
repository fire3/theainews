---
title: "DeepSeek Harness 开源实测：一切皆插件，被称'Agent 时代的安卓'"
description: "量子位深度体验 DeepSeek Harness：一切皆插件的 Agent 框架，内置百余插件与轨迹回放，实测长程任务更强，被称为'Agent 时代的安卓'。"
pubDate: 2026-08-14
author: "林晓"
category: "tools"
tags: ["DeepSeek", "Harness", "Agent", "开源", "Cordis"]
---

DeepSeek Harness（DSH）正式发布并开源，代码托管于 GitHub（deepseek-ai/deepseek-harness）。量子位作者在深度体验后刊发评测：他把几乎所有 Vibe Coding 项目从 Codex 迁移到了 Harness，最大的感触是这套框架"彻头彻尾为自进化与 DIY 而生"——模型、工具、策略、存储、上下文管理全部可插拔，官方已内置一百多个插件，被其称为"Agent 时代的安卓"。

## 上手体验：四种预设与轨迹回放

安装方式有两种：已装 Node.js 工具链的环境可直接用 npx 命令启动 Web UI；也可以 `git clone https://github.com/deepseek-ai/deepseek-harness` 源码安装。目前暂无桌面应用，启动后经浏览器使用，首次需填入模型 API Key，也支持接入其他模型。

会话开始前需要选择工作目录和 Agent 预设，官方提供四类：

- **标准模式**：功能完整的编码 Agent，涵盖文件编辑、Shell、搜索、Skills、计划模式、子代理等能力；
- **PTC 模式**：在标准模式之上提供 Code Mode SDK，允许模型编写 TypeScript 程序组合多步操作；
- **极简模式**：仅保留 bash 与 str_replace_editor 两个工具，用于基准测试和最小化复现；
- **创造模式**：在标准模式之上提供运行时检查、插件实验与预设创作指导。

DSH 的特色功能是**轨迹（Trajectory）**：与经过润色的对话视图不同，它能回放事件级原始记录，直观看到模型在哪一步出了问题、每个环节消耗多少 Token。屏幕底部还有实时统计表，可随时查看 Token 消耗与缓存命中率——实测缓存命中大多在 **99% 左右**，有时达到 100%。即便不开计划模式，遇到指令不明确时 DSH 也会主动提问并给出建议选项；图片支持作为附件上传，但 V4 本身不支持视觉输入，需搭配多模态模型使用。目前经典 Agent 的右侧栏等交互尚未完成，体验与 Codex 仍有差距。

## 实测：长程任务能力更强

量子位用 V4 Flash 分别运行 Codex 与 DSH，模型与推理强度完全一致：经典"鹈鹕自行车"测试差别不大；"生成猪八戒 3D 白模"的单句提示下，DSH 跑了约 **20 分钟**产出完整模型，Codex 仅 6 分钟完成，结果却"不像个生物"。社区反馈也一致认为 DSH 下模型的长程任务能力显著更强，有用户单次任务最长跑过 **10 小时**；一个第一人称射击游戏 demo 未给任何提示词，下蹲、换弹、瞄准、NPC 等功能全部由模型自行完成。作者的结论很直接：自家模型优先搭配自家 Harness。

## 架构：Cordis 与"Agent 时代的安卓"

DSH 的核心架构基于 **Cordis**——可以理解为乐高的底板：把整体拆解为一个个独立插件，各司其职。开发者可按规则编写新插件插到底板上，也可随时拔下替换不满意的现有插件。官方在仓库中提供了从零构建插件的教程并预留 Plugin Store；社区开发者已做出大鲸鱼 TUI、QQ 风皮肤等插件。相比之下，Codex 的 Harness 更像"闭源的 iPhone"：Rust 单体核心加 MCP 工具、hooks、skills 等外部挂件，社区难以触碰主干。DSH 还内置了 dsh-code-review、dsh-find-simplifications、dsh-doc-standards、dsh-prose-standard 等开发向 Skill。

作者认为 DeepSeek 在布局"自进化"路线：Cordis 协议下，模型可以在不打断任务的前提下自己写插件、自己安装，未来从海量 Agent 实例中筛选优质插件融回主线，是目前比较可落地的自进化实现方式。不过对普通用户而言，这仍是吃生态的功能，短期帮助有限。另据量子位报道，DeepSeek 计划 8 月 17 日调整价格，尤其是缓存价格。

## 核心总结

- DeepSeek Harness 正式开源，一切皆插件，官方已内置 100+ 插件并预留 Plugin Store；
- 四类预设：标准、PTC、极简、创造，支持自定义 Agent 运行时；
- 轨迹回放与 Token 仪表盘可监控每一步行为与成本，实测缓存命中率多在 99%；
- 同模型对比下长程任务表现明显优于 Codex，仓库内置开发向 Skill 全家桶；
- 基于 Cordis 的开放架构被称为"Agent 时代的安卓"，也是 DeepSeek 落地自进化路线的载体。

原文：[深度体验DeepSeek Harness，我原谅它涨价了](https://mp.weixin.qq.com/s/j5lAcwv2xiUSoWNlrKLwQQ)（量子位，2026-08-14）
参考：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)
