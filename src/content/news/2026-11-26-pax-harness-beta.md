---
title: "Pydantic 发布终端编码智能体 Pax：Harness 冲刺 1.0，一切皆插件"
description: "Pydantic 发布 Pax 终端编码智能体与 Harness beta：一切皆插件，可换任意模型与沙箱，SWE81 平均 58.5 居首但优势很窄。"
pubDate: 2026-11-26
author: "林晓"
category: "tools"
tags: ["Pydantic AI", "Pax", "编码智能体", "Agent Harness", "Harness-Bench", "沙箱"]
image: "/covers/2026-11-26-pax-harness-beta.jpg"
imageAlt: "封面：浅色编辑信息图风，标题「Pax：一切皆插件」配终端窗口与插件方块示意图"
topStory: true
---

11 月 25 日，Pydantic 发布终端编码智能体 <strong>Pax</strong>（Python 包名 `pydantic-ai-pax`），并宣布其 [Pydantic AI Harness](https://pydantic.dev/docs/ai/harness/) 进入 beta 阶段，计划约一个月后发布 1.0，此后沿用与 Pydantic AI 相同的版本策略。文章由 Michael Pfaffenberger、Douwe Maan、Aditya Vardhan 与 David Sanchez 联署。

值得关注的不是又一个编码 CLI，而是它对「harness」这件事的拆解方式：在 Pydantic AI 里，<strong>行业口中的「编码 harness」只是一个能力（capability）</strong>；而在 Pax 里，连编码智能体自己都是一个可以关掉的插件。官方的销量主张也很克制——Harness-Bench SWE81 上平均分最高，但「赢得勉强」。

## 三层对象：框架、Harness、终端

Pydantic 用三个层次切开了通常混在一起的东西。

<strong>Pydantic AI</strong> 是智能体框架，负责循环、各家厂商的模型、工具调用与结构化输出。要在这层之上堆可复用的部件，就传入「能力」：一组工具、指令与钩子的打包。

<strong>Pydantic AI Harness</strong> 是这套生产级能力的库。内置项包括可跨崩溃与重启的持久化执行（面向基于 SDK 构建的智能体，Pax 里还没有）、一套统一的工作区 API（覆盖本机与十余个云/本地沙箱）、基于各厂商原生工具的计算机使用、能兜住模型拒答的模型回退，以及代码模式。再加上文件与 shell 工具、护栏、记忆、子智能体、上下文压缩与 Agent Skills——这些都是 100 多个可用能力中的一部分。

<strong>Pax</strong> 则是 `Coder()` 前面的那个终端界面。Pydantic 把它定位成两件事的合体：日常可用的编码智能体，以及 Harness SDK 的能力展示柜。

![Pax 在终端里运行 anthropic:claude-opus-5-5：状态栏显示模型、100 万 token 上下文窗口与成本](/images/2026-11-26-pax-harness/pax-hero.png)

*图：Pax 的一次会话，底部状态栏给出当前模型、上下文窗口与单次成本。（来源：Pydantic）*

## 一切皆插件，包括编码智能体本身

Pax 的插件其实就是「能力」再往上抬一层：对智能体而言是工具与钩子，对终端而言是 `/commands`、状态栏条目与登录。

打开 `/plugins` 就能开关 `coder`、`sandbox`、`observability`（接 Pydantic Logfire 链路追踪）、`mcp` 等内置插件。把编码插件关掉，`/plugins disable coder`，Pax 立刻变成一个没有任何文件与 shell 工具的干净聊天客户端。任何 Pydantic AI 能力只要给 import 路径就能当插件用，Pax 甚至能应要求给自己写新插件。

这个设计判断并不只是炫技：它意味着「编码智能体」不再是终端工具的内核，而是可替换的一层。

## `--agent`：把自己的 Agent 搬进终端

插件扩展的是 Pax 的默认智能体，`--agent` 则直接换掉它：

```python
# my_agents.py
from pydantic_ai import Agent
from pydantic_ai.capabilities import LocalWorkspace
from pydantic_ai_harness import Coder

reviewer = Agent(
    'openai:gpt-6.1-sol',
    instructions='You review diffs against our internal engineering guidelines.',
    capabilities=[LocalWorkspace('.'), Coder()],
)

@reviewer.tool_plain
def get_guideline(topic: str) -> str:
    """Look up an internal engineering guideline by topic."""
    ...
```

```bash
pax --agent my_agents:reviewer
pax -a my_agents:reviewer -p "Review the diff on this branch against our guidelines"
```

此时 Pax 不加载任何插件，原样运行你的 Agent——用它自己的模型、工具与指令，但终端该有的 `--resume`、`--worktree`、`-p`、`-m` 全都还在。Pydantic 强调的用法是：在仓库里写 Agent、在真实终端里试、然后把这个<strong>同一个 Agent 对象</strong>部署进服务。

## 换沙箱，不改工具代码

文件与 shell 工具都对着「工作区」说话，所以同一个智能体既能在本机跑，也能在云沙箱里跑，工具代码一行不用改：

```python
from pydantic_ai import Agent
from pydantic_ai_harness import Coder, E2BSandbox

agent = Agent('anthropic:claude-sonnet-5-5', capabilities=[E2BSandbox(), Coder()])
```

在 Pax 里，沙箱可以在<strong>第一次提问之前</strong>切换：`/sandbox e2b`，或 `boxd`、`daytona`、`opensandbox`、`modal`、`render`、`sprites`、`kubernetes`；本地则可用 `/sandbox local smol` 或 `/sandbox local boxlite` 起一个微虚拟机。切换后 Pax 会同步分支与未提交的改动，所有编辑、构建与 `!` 命令都在沙箱内执行，`/resume` 自动重连。

一个值得记下的细节：在 e2b、boxd、daytona、opensandbox 这些带代理的 provider 上，GitHub token 不会进入沙箱，而是在出站请求时由出口代理注入。

## 代码模式、计算机使用与迁移

Pax 默认开启代码模式。模型不再来回搬运工具结果，而是用 Monty 写一小段 Python，在里面搜索、读文件，只返回有用的部分。按下 **Ctrl+X 再按 Ctrl+S** 可启用投机执行，让 Pax 在模型还在流式输出时就开始安全的读取。配合 `observability` 插件，Logfire 仍然把每个工具调用记成独立 span。

计算机使用也被压缩成一行：`ComputerUse()` 挂在 Docker 或十余个沙箱上，模型能看到屏幕、点击、输入，每一步后拿回截图，全程在沙箱里；底层按厂商支持情况自动使用 OpenAI、Anthropic 或 Google 的原生计算机使用工具。Pax 里这项能力下个版本才以 `/computer-use` 形式出现，需要先在新会话里于 `/sandbox` 之前开启，并要求 `/permissions full`。

迁移路径也做得很直白：`/resume` 会把现有的 Claude Code 与 Codex 会话并列显示，或用 `pax --resume-claude`、`pax --resume-codex` 直接导入后换任意模型继续。仓库约定同样继承——`repo_context` 读 `AGENTS.md` 与 `CLAUDE.md`，默认的 `coder` 插件从 `.agents/skills` 和 `.claude/skills` 加载 Agent Skills。

## 跑分：赢了，但赢得很窄

Pydantic 在 Terminal-Bench 与 Harness-Bench 上做了对比。在 Harness-Bench SWE81 的 8 模型横评中，同一模型内部对比、只换 harness，跑满全部 8 个模型的四个 harness 平均分如下：

| Harness | 平均分 | 单次平均成本 |
| --- | --- | --- |
| Pax | 58.5 | $7.69 |
| OpenCode | 58.2 | $8.04 |
| deepagents-code | 57.6 | $9.43 |
| pi | 57.3 | $6.47 |

Pax 以 0.3 分领先 OpenCode，而 pi 比它便宜 1.22 美元。对原生 harness 的对比更能说明成本结构：

| 模型 | Pax | 原生 harness |
| --- | --- | --- |
| GPT-6.2 Sol | 64.7 分 / $9.21 | Codex 60.1 分 / $21.05 |
| Claude Opus 5.5 | 61.2 分 / $24.61 | Claude Code 60.4 分 / $25.10 |

也就是说，在 Sol 上 Pax 用不到一半的成本拿到 4.6 分优势；在 Opus 上两者成本几乎持平，Pax 只多 0.8 分。

官方的限定写得很清楚：这是 11 月的<strong>单次运行</strong>；Sol 与 Opus 用了宽松重打分，且该重打分对所有 harness 一致应用；跑 Sol 时 Pax 用的是 `Coder(autonomy='max')`，即从不中途提问的无人值守设置；完整方法论与重跑结果将随 1.0 一并发布。文中也给了反向数据——换回原生打分器时，Sol 上 Pax 51.0 对 Codex 49.8；另一次 GPT-6.1 Sol 的直接对拼里，Pax 62.4 反而输给 Codex 63.0，只是省了 29% 成本（每次运行 800 万对 2080 万输入 token）。

## 核心总结

- **发布内容**：Pax（`pydantic-ai-pax`）是 Pydantic AI 的官方终端编码智能体，构建在 Pydantic AI Harness 之上；Harness 进入 beta，约一个月后发布 1.0 并启用与 Pydantic AI 相同的版本策略。
- **核心设计**：代码模式默认开启；Harness 的每个能力在 Pax 中都是一层插件，连编码智能体本身都能用 `/plugins disable coder` 关掉，退化成纯聊天客户端。
- **可替换性**：`--agent` 能把仓库里任意 Pydantic AI `Agent` 搬进终端且不加载任何插件；工作区 API 让同一套工具代码在本机与八种云沙箱、两种本地微虚拟机之间迁移。
- **跑分**：Harness-Bench SWE81 八模型平均分 58.5 居首，但仅领先 OpenCode 0.3 分；相对 Codex 的成本优势明显（$9.21 对 $21.05），相对 Claude Code 几乎持平。
- **试用方式**：`uvx pydantic-ai-pax`。macOS 自带一个同名的 `/bin/pax` 归档工具，装完启动不了就开新终端，或直接用 `pydantic-ai-pax`。

原文：[Introducing Pax and the Pydantic AI Harness beta, on the road to 1.0](https://pydantic.dev/articles/pax-harness-beta)（Pydantic Blog，2026-11-25）
