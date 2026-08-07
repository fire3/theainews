---
title: "AutomationBench：用真实业务流程给 AI 智能体出题"
description: "Zapier 开源的 AI 智能体基准：600 个跨 47 个模拟 SaaS 的业务任务，要求自动发现 API 并遵守业务规则，公开集最强模型通过率约 50%。"
pubDate: 2026-08-07
author: "林晓"
category: "research"
tags: ["AutomationBench", "AI 智能体", "基准测试", "Zapier", "工作流自动化"]
---

一个真实的业务任务往往横跨多个系统：先查 CRM 里的客户等级，再按政策文档判断该不该升级，从邮箱里找对联系人，最后在日历和 Slack 上完成排期与通知。现有基准要么只测单应用的 API 调用，要么让智能体在固定工具集里选，很少同时考验"跨应用协调 + 自主发现 API + 遵守业务政策"这三件事。Zapier 发布的 AutomationBench 就是冲着这个空白来的——它把自家平台上的真实工作流模式改造成了一个可编程验证的智能体基准。

## 论文与开源仓库

AutomationBench 有两个公开入口：[论文（arXiv:2604.18934）](https://arxiv.org/abs/2604.18934)和[开源仓库（zapier/AutomationBench）](https://github.com/zapier/AutomationBench)（MIT 协议）。论文于 2026 年 4 月发布，作者是 Zapier 的 Daniel Shepard 与 Robin Salimans；仓库持续迭代，目前为 v1.0.6，支持命令行评测、可视化面板，并托管在 Prime Intellect 的评测环境上。

## 基准怎么设计

每个任务包含四部分：一段触发数据（初始化工作流的自然语言指令）、一个预置好的模拟业务环境（CRM、日历、收件箱等）、一套领域工具、以及基于断言的程序化评分。任务覆盖 **Sales、Marketing、Operations、Support、Finance、HR 六个领域**，每个领域 100 道公开任务，背后是 **47 个模拟 SaaS 应用、约 500 个 REST API 端点**。另有 200 道更基础的单步/两步任务组成的 `simple` 域，用于验证模型的基础工具调用能力，但不计入得分。

与"给工具列表让模型选"的常见做法不同，模型手里只有两个工具：

- **Search**：对全部 API schema 做 BM25 关键词检索（top-k=5），帮助定位相关端点
- **Execute**：模拟 curl/fetch，接收 method、url、body 发起 REST 调用，不模拟认证

也就是说，**找到正确的端点是任务的一部分**——模型必须自己探索 API 文档，弄清楚应该调哪个应用、哪个接口，而不是被提前告知。所有模拟应用的状态由 Pydantic 模型维护，API 保留真实 schema 的形态，包括分页、必填字段和 4xx 错误。

评分只看**最终状态**：数据有没有写到正确的系统里。过程怎么实现的不重要——用并行调用、批量修改还是绕路都能得分，但必须把所有断言都满足才算通过；负向断言（如"不能群发邮件"）用来防止刷分。官方榜单为严格通过率（所有断言全过），环境奖励信号则同时输出 0–1 的 `partial_credit`，供强化学习训练使用。整个评分是确定性的字符串与结构比对，不用 LLM 当裁判。

## 难度从哪来

为了让任务贴近真实又不容易"刷穿"，作者做了大量硬化处理：环境里塞无关数据和诱饵记录、关键信息藏在工具调用返回里、错误条目用相似命名混淆、还有层层叠加且优先级会互相覆盖的业务政策。涉及主观判断的任务（如评估销售线索质量）不允许自由发挥——模型必须把决策写成结构化状态变更（改状态字段、打分、路由到队列），断言再去验证记录和下游影响。

一个典型的例子：2026 年 2 月 20 日 14:00 有一场 Zoom 会议和 Google Calendar 事件时间冲突，需要查电子表格里的会议优先级政策判断谁赢，给输的一方标题加 `[RESCHEDULED]` 前缀，再到 Slack 的 #ops-updates 发摘要，附上 Zoom 会议 ID 和 Calendar 事件 ID。

作者特意强调，政策遵守任务在提示词里会**显式指明政策文档**，避免把"遵守政策"和"提示注入"混为一谈。任务基于 Zapier 客户真实反馈的工作流模式合成生成（不包含真实客户数据），由 Opus 4.6、GPT 5.3 Codex 和 Gemini 3 辅助产出，并基于 Prime Intellect 的 Verifiers 框架用带可验证奖励的强化学习做了压力测试，以堵住奖励黑客漏洞。

## 模型表现：从不到 10% 到 50%

论文发布时（2026 年 4 月）的官方榜单基于**私有评测集**，最强模型全部低于 10%：

| 模型（推理档位） | 得分 | 每任务成本 |
|---|---|---|
| Opus 4.7（max） | 9.9% | $1.80 |
| Gemini 3.1 Pro（high） | 9.6% | $0.54 |
| GPT 5.4（high） | 7.6% | $1.93 |
| Sonnet 4.6（max） | 5.3% | $1.81 |
| Haiku 4.5 | 1.5% | $0.18 |
| GPT 5.4（无推理） | 1.2% | $0.19 |

到 2026 年 7 月，仓库 README 公布的最新**公开集**通过率（最高推理档位）已经大幅提升：Claude Opus 5 以 50.3% 居首，Kimi K3 46.67%、Claude Fable 5 46.17%、GPT-5.6 Sol 45.83%、Gemini 3.6 Flash 45.00% 紧随其后。模型进步肉眼可见，但即便是最强模型也还有一半任务完不成——这正是基准想暴露的差距。

需要特别说明：**公开集分数与官方榜单并不直接对应**。官方榜单用的是另一套不公开、且会随版本更新变难的私有任务集；公开集只是分布和验证框架相似的研究用任务。作者说两者方向一致：公开集提升大概率（但不保证）意味着私有集提升。

## 自己跑一遍

仓库用 `uv` 管理依赖，一条命令即可跑起评测：

```bash
git clone https://github.com/zapier/AutomationBench.git
cd AutomationBench
uv sync
export OPENAI_API_KEY=sk-...

# 跑默认模型（gpt-5-mini）
uv run auto-bench --model gpt-5-mini

# 只跑销售域，指定推理强度，并导出 JSON
uv run auto-bench --model gpt-5-mini --domains sales --reasoning-effort high --export-json results.json
```

常用参数包括：`--toolset`（`api` 用原始 REST 工具，`zapier` 用模拟 Zapier 动作，`limited_zapier` 受限版本）、`--max-steps`（默认 50）、`--max-concurrent`（默认 100 并发）、`--base-url` 和 `--api-key`（可接入任意兼容端点，Anthropic 模型按 `claude-*` 前缀自动识别）。评测结果会自动写入 `visualizer/runs/`，运行 `python3 visualizer/serve.py` 即可在 http://localhost:8000 打开可视化面板，支持成本/得分散点图、逐任务对比和多轮评测对比（2–5 轮并排）。

## 值得注意的设计选择

- **只看结果、不看过程**：与业务方的真实评价方式一致，也给了智能体策略自由度，代价是不鼓励"最优过程"
- **不模拟认证**：省去登录复杂度，把挑战集中在端点发现与编排本身
- **公开/私有任务分离**：公开集支持研究与复现，私有集保证榜单防过拟合
- **成本与得分并列**：同一得分下 Gemini 3.1 Pro 成本只有 Opus 4.7 的三分之一，效率是榜单上的第二个维度
- **开放协作**：作者明确欢迎报告 bug 和"不公平任务"，版本迭代时会在修复后重跑所有模型更新分数

局限也同样明显：任务全部为合成数据，存在偏离真实系统的风险；主观判断被压缩为结构化决策记录，测不出开放式的业务判断力；任务越"硬化"，离日常真实工作流可能越远。这些都需要后续版本来校准。

## 核心总结

- **测的是真问题**：跨应用协调、自主 API 发现、业务政策遵守三合一，是现有基准缺的一块拼图
- **设计克制**：只看最终状态、确定性断言、无 LLM 裁判，公开/私有任务分离防过拟合
- **结果现实**：2026 年 4 月最强模型私有集不足 10%，7 月公开集已到约 50%，进步快但差距仍大
- **上手容易**：`uv run auto-bench` 一条命令评测，支持自定义端点、并发、推理档位和结果可视化

原文：[AutomationBench 论文](https://arxiv.org/abs/2604.18934) · [AutomationBench GitHub 仓库](https://github.com/zapier/AutomationBench) · [Zapier 官方榜单](https://zapier.com/benchmarks)
