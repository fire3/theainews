---
title: "LangChain 发布 Managed Deep Agents 公测：写好智能体，托管交给 LangSmith"
description: "LangChain 宣布 Managed Deep Agents 进入公开测试：Python/TypeScript 编写智能体，一条命令部署到 LangSmith 托管运行时，自带持久化、沙箱、Harbor 评测与 Slack 通道。"
pubDate: 2026-08-08
author: "林晓"
category: "tools"
tags: ["LangChain", "Deep Agents", "LangSmith", "AI 智能体", "Agent 基建"]
---

8 月 7 日，LangChain 宣布托管版 Deep Agents（Managed Deep Agents，简称 MDA）进入**公开测试（public beta）**。它的核心主张可以压缩成一句话：你继续用喜欢的语言和框架写智能体，把持久化、沙箱、评测、部署这些"跑生产"的基建交给 LangSmith。

在此之前，Deep Agents 是一个开源 Agent 框架；MDA 则是在同一套 Harness 之上，加了一层托管运行时。面向的对象很明确：想让 Agent 上生产、又不想自己维护那些又贵又容易出错的底层基础设施的团队。

## 从一个反复出现的模式说起

LangChain 做 Deep Agents 的出发点，是他们观察到一个在真实 Agent 里反复出现的共性结构。能干的 Agent 往往都需要：调用工具、有地方放长期工作文件、在长任务里管理渐长的上下文、把子任务委托给子 Agent、加载领域技能、以及在执行敏感操作前暂停等人批准。

这件事用底层框架自己做，每个团队都要重造一遍。所以 LangChain 把这一套打包成一个**可复用、可自主掌控**的开源 Harness——Deep Agents。它不绑定模型，你可以带自己的模型、指令、工具和业务逻辑进来。

MDA 则是帮企业把这个 Harness 送上生产：由 LangSmith 处理运行时，开发者只负责让 Agent 变得独特的部分——提示词、工具、中间件、身份规则、评测和领域逻辑，而不是反复搭建每个 Agent 都需要的同一套基建：

- **持久化执行**：长运行 Agent 可以暂停、重试、恢复而不丢进度
- **流式输出**：用户能实时看到 Agent 的执行过程
- **持久性**：线程状态跨轮次、跨重启、跨故障存活
- **沙箱**：Agent 在隔离环境里操作文件、运行代码、调用 CLI
- **评测**：上线前后测试行为、工具调用与状态变化
- **通道**：Agent 能入驻 Slack 等协作工具触达用户
- **内存**：跨对话携带长期上下文与偏好
- **身份**：以正确的用户上下文与访问边界行事

## 代码优先：一个 Agent 就是一个目录

MDA 是仓库里一个"代码优先"的项目，所有 Agent 原语被组织成简单清晰的目录结构：

```text
my-agent/
├── agent.py | agent.ts        # 主逻辑
├── pyproject.toml             # 项目依赖
├── instructions.md            # 提示词，同步到 Context Hub
├── identity.py                # 身份、线程与内存作用域
├── memory.py                  # 定义 Agent 内存
├── tools/                     # 自定义工具
├── channels/                  # Slack、GitHub 等入口
├── middleware/                # 自定义中间件
├── schedules/                 # 托管定时任务
├── skill/                     # 同步到 Context Hub 的技能
├── sandbox/                   # 沙箱配置
└── evals/                     # Agent 评测
```

上手流程也压缩成了几条命令：

```bash
uv tool install managed-deepagents   # Python
# 或 npm install -g managed-deepagents  # TypeScript

mda init research-assistant
cd research-assistant
uv sync                             # 或 npm install
mda dev                             # 本地跑在 LangSmith Studio
mda deploy                          # 部署到 LangSmith
```

本地写好、`mda deploy` 一键部署：MDA 会编译项目、把 deploy 拥有的上下文同步到 LangSmith Context Hub、上传构建产物，并创建一个托管的 LangSmith 部署。要更新提示词或技能，重新部署即可，运行时产生的内存会保留——升级 Harness 不会抹掉 Agent 已经学到的东西。

## 底层：LangSmith Deployment 的运行时间

为什么这些"生产原语"能开箱即用？因为 MDA 构建在团队已经在用的 **LangSmith Deployment Agent Server** 之上。大多数生产基础设施假设的是短命、无状态请求，而 Agent 恰恰两条都打破——它往往要跑几分钟、几小时甚至几天，可能为了等人批准而暂停、等用户回复后恢复、边工作边流式输出，还要能在基础设施重启后不丢状态地恢复。持久化线程、内存、取消、重试、跨模型调用/工具调用/文件/错误/运行时状态的全链路追踪……这些自己从头搭要几个月甚至几个季度，还得持续维护。

MDA 把这些操作模式打包进一个更"主见"的 Deep Agents 运行时，于是生产原语开箱即得。

## 沙箱：给 Agent 一个受控的工作场所

很多实用 Agent 需要一个隔离的工作环境来查看文件、写输出、跑测试、装依赖、调 CLI、安全执行代码。Deep Agents 支持这类工作的沙箱后端，MDA 对 LangSmith Sandboxes 提供了一等支持，几行代码即可配置：

```python
from managed_deepagents import define_sandbox

sandbox = define_sandbox(
    provider="langsmith",
    scope="thread",
)
```

默认每个持久化线程都有自己独立的沙箱——这很适合"每个用户会话/任务一个隔离工作区"的编码类 Agent。也可以把 scope 设为 `agent`，让整个 Agent 进程跨线程共享一个沙箱。MDA 负责沙箱的供给、生命周期与清理，沙箱活动还会被追踪到 LangSmith，运行成功或失败都能回溯到底发生了什么。

## 评测：用 Harbor 检查"过程"而不只是"结论"

验证一个 Agent 的行为，不能只评测提示词和最终答案，更要看它一路做了什么：有没有调对工具？改对文件？产出预期工件？最终工作区状态是否符合任务？对代码和文件型 Agent 来说，这类基于状态（state-based）的检查往往比只给最终消息打分更有用。

MDA 用 **Harbor** 来做这件事：Harbor 任务给 Agent 一个指令，在隔离环境里运行它，再用 verifier（验证器）给产出的文件或状态打分。难点通常在于如何把 Agent 打包成 Harbor 能运行的形式——MDA 替你搞定了，只需几条终端命令：

```bash
mda evals init      # 在 evals/ 下创建可版本化的 Harbor 任务
mda evals compile   # 构建 .mda/evals/ 下的 Harbor handoff
```

Harbor 本身仍在本地 Docker 或其他你配置的 Harbor 环境里运行，保证评测可移植。**MDA 搭建的是从"生产就绪的 Agent"到"Harbor 可用工件"的桥**。部署之后，你还可以在 LangSmith 里管理评测、监控生产行为——每一次运行都被追踪，生产故障会变成未来的测试用例，形成反馈闭环。

## 通道：让 Agent 走进工作真正发生的地方

通道（channels）是把你 Agent 暴露给用户的方式。MDA 提供一等支持，让定义 Agent 如何接入不同通道（比如 Slack）变得很直接。在 `channels/` 下加一个文件，运行时就会挂载提供方事件端点、验证签名、用身份戳调用你的 Agent，并在原对话里回复。对 Slack 来说，简单到这样：

```python
from managed_deepagents import channels

channel = channels.slack(
    on=["app_mention", "direct_message"],
    auto_reply=True,
)
```

通道让 Agent 无需单独的集成服务就能接收 Slack 等系统的事件并回复。这对需要与人协作的 Agent 尤其有用——比如能在 GitHub 上评论的代码审查 Agent，或者在 Slack 里回复的支持/运营 Agent。用户可以直接在团队已经在用的地方 @ 到 Agent。

## 内存与身份：跨对话、多用户的关键拼图

线程状态只够管理单次对话，很多 Agent 需要的是**跨对话**也带着的长期上下文。MDA 给每个部署的 Agent 默认提供"agent 级内存"：你在 `memory.py` / `memory.ts` 里定义内存行为，运行时用 Context Hub 做后端，Agent 在运行时读写 `/memories/` 下的内存文件。

身份方面，MDA 目前已有一个基础身份模型，后续会持续增加更高级的认证与凭据流。今天，你的 Agent 可以用一组固定凭据运行；如果你在 `identity.py` / `identity.ts` 里定义了一个 OIDC 提供方，MDA 会按你的 OIDC 提供方的每个用户 ID 划分线程，让同一部署下每个用户的线程互相隔离。身份系统也是作用域化内存和未来凭据模式的基础——它给 Agent 一个可信的方式知道"是谁触发了这次运行"，而不是依赖提示词文本或可伪造的请求字段。

## 团队已经在用它

已有团队在用 MDA 加快上线速度，把精力放在 Agent 行为而不是基建、规模和运行时上：

- **Fullstory 产品总监 Chip Lay**：MDA 用起来很棒，强烈推荐给想构建更完整的托管方案、又不想被模型或实验室绑定的团队。
- **某 stealth 初创的 Staff Engineer Mathieu Mailhos**：MDA 让我们把 Agent 工作力量规模化——一个 Agent 从想法到上线只要几小时而不是几周。他们的"教师 Agent"每天早上醒来检查整个舰队（fleet）的运行情况，基于可观测性与实时评测推动改进；团队专注业务逻辑，MDA 处理从持久化内存、运行时到 Slack 和 GitHub 集成的所有操作复杂度。

## 什么时候该用 MDA

MDA 适合想要一个代码优先的 Deep Agent、同时让 LangSmith 来承接持久化、执行、部署和围绕 Harness 的公共脚手架的场景：

- 基于开源 Deep Agents Harness 构建
- 保持对模型、提示词、工具、中间件与业务逻辑的掌控
- 不想从零重建 Agent 基建就完成部署
- 需要持久的线程、内存、沙箱、通道、定时任务、评测与追踪
- 想从本地开发快速过渡到托管的 LangSmith 部署

如果你需要自定义路由、与应用代码并列的图、自定义认证逻辑，或想直接控制持久化层，就用 LangSmith Deployment 本体；如果你想自己运营 Harness，Deep Agents 是开源的，可以在自己选的基础设施上跑。

## 公测范围与后续

当前公测的边界也值得注意：

- **仅限 LangSmith Cloud 的 US 区域**
- **CLI 优先**，因为官方支持 API 还在收尾
- 更多区域和部署方式后续才会支持

这些是 beta 期的原语，LangChain 欢迎团队跑过工作负载后反馈，一起演进。上手可以从快速开始走一遍：它会一步步带你加上身份、内存、工具与评测；想要开源 Harness 就从 Deep Agents overview 开始，做好生产化准备后再用 MDA 部署。

## 核心总结

- **定位**：MDA 是 Deep Agents 开源 Harness 之上的托管运行时，由 LangSmith 承接持久化、执行、部署与公共脚手架
- **控制权**：模型、提示词、工具、中间件、业务逻辑仍完全由你掌控，只把生产基建外包出去
- **原语开箱即得**：持久化线程、流式、内存、沙箱、Harbor 评测、Slack 通道、身份隔离一应俱全
- **上手快**：`mda init` → `mda dev` → `mda deploy`，代码优先、一条命令上生产
- **当前边界**：公测仅限 LangSmith Cloud US 区域、CLI 优先，更多区域与部署方式待后续

一句话：Deep Agents 让"写好一个能干的 Agent"更简单，MDA 则让"把它安全可靠地跑在生产里"更简单。对那些不想在自家堆 K8s、消息队列和状态存储的团队来说，这可能是把 Agent 从原型推向规模最快的一条路。

原文：[Managed Deep Agents is now in public beta](https://www.langchain.com/blog/managed-deep-agents-is-now-in-public-beta)（LangChain）
