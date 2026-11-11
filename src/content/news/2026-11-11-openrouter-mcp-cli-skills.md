---
title: "OpenRouter 实测 MCP、CLI 与 Skill 的上下文成本：同一个任务最多差 70 倍"
description: "OpenRouter 在同一个 GitHub 任务上实测三种取工具方式：CLI 1,421 token、Skill 3,315、GitHub MCP 默认 59,417，成本相差 17 倍。"
pubDate: 2026-11-11
author: "林晓"
category: "research"
tags: ["OpenRouter", "MCP", "CLI", "Agent Skills", "上下文工程", "Tool Search", "token 成本"]
image: "/covers/2026-11-11-openrouter-mcp-cli-skills.jpg"
imageAlt: "封面：白底学术风，左侧标题「MCP 的上下文账单」，右侧三条递增的横向条形表示 CLI、Skill 与 MCP 的 token 用量"
topStory: true
---

11 月 11 日，OpenRouter 发布了一篇实测文章，比较给智能体接入工具的三条路线——MCP 服务器、命令行工具（CLI）与技能（Skill）——在上下文里到底花多少 token。测试任务是同一个 GitHub 查询：「cli/cli 仓库的最新 release 是什么，最近打开的带 bug 标签的三个 issue 是什么」，分别用 GitHub MCP 服务器 v2.0.2、`gh` CLI 与一个 gh 技能完成，模型覆盖 Claude Haiku 5.5、Sonnet 5.5、GPT-6 Luna 与 Gemini 3.8 Flash，每种组合在 10 月 20 日跑三次取中位数。

结论先摆出来：在 Sonnet 5.5 上三种方式都答对了，但输入 token 分别是 CLI 1,421、Skill 3,315、加载默认 46 个工具的 MCP 服务器 59,417。按每千次任务计，默认 MCP 的成本是 127 美元，CLI 是 7.5 美元。

## 三者的差别：模型在使用前要读什么

| 方式 | 每次请求先看到 | 真正行动时看到 |
| --- | --- | --- |
| MCP 服务器 | 每个工具的名称、描述与 JSON Schema，每次请求都发 | 服务器返回的原始结果 |
| CLI | 一个 shell 工具，外加一行「`gh` 已安装并登录」 | 命令输出，可用 `--json` 等参数裁剪 |
| Skill | 每个技能一行描述 | 需要时才读一次 `SKILL.md`，之后是命令输出 |

CLI 依赖模型本来就熟悉这个工具；Skill 的作用是把「怎么用」教给模型；MCP 提供带类型定义、自带鉴权、不依赖 shell 的工具，但代价是定义要一直挂在上下文里。

## 工具定义本身就是固定开销

作者用「带工具与不带工具的 `usage.prompt_tokens` 差值」来测量，而不是本地分词器——不同 provider 会用自己的格式把工具定义写进提示词。结果：

- GitHub MCP 服务器默认 46 个工具，每次请求为 Haiku 5.5 增加 19,436 token、GPT-6 Luna 8,903、Gemini 3.8 Flash 8,525
- 同一份工具，走 Google Vertex 是 8,525 token，走 Google AI Studio 是 13,010
- 工具越多越贵：Haiku 5.5 上 issues 工具集 10 个工具增加 5,801，users 工具集 1 个工具增加 619

也就是说，工具定义的开销同时取决于模型与 provider，必须在你要跑的那个模型上实测。

## 同一任务：CLI 1,421，默认 MCP 59,417

| 方式 | Sonnet 5.5 token | Sonnet 5.5 每任务成本 | GPT-6 Luna token | Gemini 3.8 Flash token |
| --- | --- | --- | --- | --- |
| CLI | 1,421 | $0.0075 | 627 | 5,292 |
| Skill | 3,315 | $0.0118 | 1,542 | 6,107 |
| MCP，2 个工具 | 23,228 | $0.0552 | 14,479 | 17,267 |
| MCP，默认 46 个工具 | 59,417 | $0.1274 | 116,282 | 35,409 |
| MCP，全部 91 个工具 | 101,351 | $0.2113 | 135,238 | 53,289 |
| MCP，2 个工具，结果截断到 4,000 字符 | **5,357** | $0.0191 | 2,726 | 2,943 |

这张表里的每一种组合都答对了。Sonnet 5.5 上默认 MCP 的输入 token 是 CLI 的 42 倍，成本是 17 倍。Skill 比裸 CLI 贵，原因很具体：`SKILL.md` 一旦被读进对话就留在上下文里，后续每轮都要重发。对模型已经熟悉的 CLI，Skill 可以省掉；对自研 CLI，Skill 才是让模型学会命令的方式。

![同一次 GitHub 任务在整个对话中的输入 token 构成：紫色为工具定义与说明，黄绿色为任务、工具结果与回复。](/images/2026-11-11-openrouter-mcp-cli-skills/token-cost-chart.png)

## 结果对象比工具定义还贵

`get_latest_release` 返回了 GitHub 完整的 release 对象，42,182 个字符，其中 87% 在描述 22 个下载文件；模型真正需要的只有 tag 与日期，也就是 `gh release view -R cli/cli --json tagName,publishedAt` 的两个字段。这个对象会留在上下文里随每次后续请求重发，在 Sonnet 5.5 上约合 20,400 token，比全部 46 个工具定义还多。

把服务器限制到 2 个工具，首个请求从 19,487 token 降到 1,406，但整个任务仍是 23,228 token——大头在结果。文章给出两种修法：

- **收窄工具范围**：用 `--tools=` 或 `--toolsets=` 只暴露需要的工具
- **在客户端裁剪结果**：把结果截到 4,000 字符后，整任务降到 5,357 token，且每次都答对

作者也提醒截断有运气成分：这次能行，是因为 GitHub 恰好把 tag 与日期放在对象最前面。截断与 Tool Search 叠加后，Gemini 3.8 Flash 与 Haiku 5.5 各自三次只答对一次，Gemini 还有一次在重试时撞上了 12 次请求上限。更稳妥的做法是保留完整字段、只挑需要的字段：GitHub 服务器的 `list_issues` 支持 `fields` 参数，只取编号、标题与创建时间，结果从 8,336 字符降到 714 字符；不指定时，模型会自己决定要多少——GPT-6 Luna 在六次运行里有四次索要 100 个 issue 的全文，拿回 281,963 个字符。

## Tool Search：省工具定义，不省工具结果

OpenRouter 自家的 Tool Search 用 `defer_loading: true` 标记工具，并挂上 `{ "type": "openrouter:tool_search" }`，把定义暂扣，只发一个检索工具；模型用正则搜索工具名与描述，下一轮再调用命中的工具。46 个工具全部延迟后，检索前的固定开销在 Claude 上是 578 token，GPT-6 Luna 144，Gemini 3.8 Flash 130。

但整个任务的账单要看模型：

| 模型 | MCP 加载 46 个工具 | Tool Search，延迟 46 个 | Tool Search，延迟 91 个 |
| --- | --- | --- | --- |
| Claude Sonnet 5.5 | 59,417 | 30,334 | 31,615 |
| GPT-6 Luna | 116,282 | 25,544 | 57,975 |
| Gemini 3.8 Flash | 35,409 | 37,568 | 38,445 |
| Claude Haiku 5.5 | 99,319 | 154,623 | 31,781 |

Sonnet 5.5 上，91 个延迟工具只比 46 个多 1,281 token；而全部加载时，多出来的 42,000 token 是实打实的。Tool Search 并不缩小工具结果，Sonnet 的第二个请求仍被 release 对象占满。Haiku 5.5 反而变贵：三次运行里它都向 `list_issues` 要了一个该工具不支持的字段，然后用错误类型的参数重试三四次；加载全部工具时它也犯同样的错，但下一轮就自己改对了。作者的建议是给循环设请求上限，并在成本异常飙升时检查工具报错。

另外两个限制：Tool Search 通过放宽 `tool_choice` 来暴露工具，所以同时强制工具调用的请求会返回 400；Chat Completions 接口不接受 `openrouter:tool_search`，需要改用 Responses 或 Messages API。

## 怎么选

| 你的情况 | 建议 | Sonnet 5.5 上的实测 |
| --- | --- | --- |
| 有成熟的 CLI，且智能体能执行命令 | 直接用 CLI | 每任务 1,421 token |
| 自研 CLI，或模型用得时好时坏 | CLI + Skill | 3,315 token |
| 没有 CLI 或 shell，或需要服务器的鉴权与权限 | MCP，只开需要的工具 | 2 个工具 23,228，46 个 59,417 |
| 跨多个服务器的大工具库 | MCP + Tool Search | 91 个延迟工具约等于 46 个 |
| 任何 MCP 路线 | 把结果裁到需要的字段 | 23,228 降到 5,357 |

OpenRouter 还补充了两点：提示词缓存能把缓存输入的价格降到十分之一左右，但并不会把 token 从上下文里移走；Tool Search 的官方文档建议，当工具定义超过约 10,000 token 或约 10 个工具时就开始延迟加载，并把最常用的三到五个工具留在加载状态。

需要说明的是，这是 OpenRouter 用自己的一个 MCP 服务器、一个任务做的测量，文章中也在推销其 beta 阶段的 Tool Search；作者自己在文末承认样本有限，建议读者用文章附带的 `mcp_cost.py` 在自己的服务器与模型上重跑一遍再决定。

## 核心总结

- 工具定义按请求计费：GitHub MCP 的 46 个默认工具在 Haiku 5.5 上每次请求固定增加 19,436 token，换模型、换 provider 都会变
- 同一个 GitHub 任务，CLI 用 1,421 token、Skill 用 3,315、默认 MCP 用 59,417，成本差 17 倍且都能答对
- 真正的开销常来自工具结果：一个 42,182 字符的 release 对象约合 20,400 token，比全部工具定义还贵
- 最有效的两步是收窄工具范围与只取需要的字段（23,228 降到 5,357），粗暴截断会牺牲稳定性
- Tool Search 能把工具定义的固定开销压到几百 token，但在 Haiku 5.5 这类容易用错参数的模型上反而更贵，需按模型实测

原文：[MCP vs CLI vs Skills: What Each Costs in Context](https://openrouter.ai/blog/insights/mcp-vs-cli-vs-skills/)（OpenRouter，2026 年 11 月 11 日）
