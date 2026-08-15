---
title: "开源模型夏季观察：中国实验室领跑前沿，Qwen 成为社区基础模型"
description: "Hugging Face 发布 2026 夏季开源模型报告：中国实验室月参数量上限达 2.78 万亿、Qwen 派生模型超 15 万、代码智能体首次成为 Hub 头号用户。"
pubDate: 2026-08-15
author: "林晓"
category: "industry"
tags: ["Hugging Face", "开源模型", "Qwen", "智能体", "行业报告"]
image: "/images/state-of-open-models-summer-2026/frontier-ceiling-by-country.png"
imageAlt: "2026 年中美实验室月度最大开源模型发布参数量对比"
---

Hugging Face 8 月 14 日发布《**开源模型现状：2026 年夏季观察**》报告，基于 2026 年前 7 个月的 Hub 活动数据，梳理了开源生态在模型规模、下载、许可证与智能体使用等维度的变化。报告认为，**地理权力再平衡正在加速**：中国实验室把前沿模型参数量上限抬到 2.78 万亿，Qwen 已成为社区的「基础模型」，而**代码智能体首次成为 Hub 的头号用户**。

![Hugging Face 数据集按任务分类的累计增长，2026 年突破 100 万](/images/state-of-open-models-summer-2026/dataset-growth.png)

## 前沿在快速前移：中国实验室跳过渐进路线

过去实验室通常从小模型逐步做到大模型，但 2026 年多家中国实验室直接跳过这一渐进路径。中国的「月度上限」在 [754B 到 2.78 万亿参数](https://huggingface.co/blog/state-of-open-models-summer-2026)之间浮动；美国多数月份的上限维持在 130B 以下，例外是 NVIDIA 的 Nemotron 3 Ultra（561B）与 Thinking Machines 的 Inkling。

![中美实验室 2026 年月度最大开源模型发布](/images/state-of-open-models-summer-2026/frontier-ceiling-by-country.png)

报告把实验室分为两派：Moonshot、MiniMax、Xiaomi、Z.ai 几乎不发布 70B 以下的模型；腾讯与阿里 Qwen 则覆盖从 1B 以下到顶端的全区间。能做到第一派，是因为「做大的差异化已经消失」——Xiaomi 与 Meituan 今年都突破了万亿参数，而它们一年前在开源权重领域还名不见经传；同时，社区的量化层会让一个大模型在数天内可本地运行，实验室不必再靠小模型获取覆盖。**模型规模的分布如今更像战略声明，而非能力上限**。

![各实验室的模型规模策略](/images/state-of-open-models-summer-2026/lab-size-strategy.png)

硬件厂商也意识到开源模型是卖芯片的方式：针对自家硬件优化、免费开放，是最有力的证明。报告指出，**开源从模型实验室转移到了硬件与基础设施公司**。美国今年 100B 以上参数的大多为中国模型的二次开发，原创大模型仅有 Inkling（952B）、Nemotron 3 Ultra（561B）、Nemotron 3 Super（124B）与 Arcee AI 的 Trinity-Large（399B）等少数几个；AMD 贡献了大量转换但几乎没有该规模的原创模型。

## 关注 ≠ 采用：下载与赞是两种经济

报告将今年累计下载量前 25 与点赞量前 25 的模型仓库做了对比，**两个榜单只有 1 个仓库重合**。下载统计的是窗口期内而非累计，因此靠存在时间长并不能上榜：2026 年发布的模型没有一个进入下载前 25，而 25 个里有 13 个来自 2022 年。all-MiniLM-L6-v2 七个月被拉取 15.5 亿次却只有 5,156 个赞；Kimi-K3 每获得一个赞约被拉取 60 次。

![关注与使用是两种不同的经济](/images/state-of-open-models-summer-2026/attention-vs-usage.png)

「点赞说明一次发布重要，流向发布数周内的前沿模型；而下载说明某物被接入了按计划运行的流水线，多年累加给小型、稳定的模型。」中国前沿实验室是唯一「重模型带」扛起下载量的账户：MiniMax 今年下载几乎全部在 70B 以上，Moonshot 占 88%、DeepSeek 占 55%、Z.ai 占 39%。Moonshot 全前沿组合全年录得 3,700 万次下载，而 Qwen 覆盖多尺寸的发布策略达到 20.45 亿次，约为前者的 55 倍。

![各实验室按模型规模的下载分布](/images/state-of-open-models-summer-2026/downloads-by-lab-and-model-size.png)

## 开源权重重塑价值积累点：许可最宽松

如果前沿模型是授权生意，最大的发布应带最严的条款，但数据并非如此。今年 178 个 20B 参数以上的中国发布中，**59% 采用 Apache 2.0、22% 采用 MIT**，没有一个带非商用限制。DeepSeek 与 Z.ai 在 7,000 亿到 1.65 万亿参数之间用纯 MIT 发布模型。

![不同地区与规模的模型许可证分布──许可并不是商业模式](/images/state-of-open-models-summer-2026/model-licenses-by-region-and-size.png)

「无论是为何发布这些模型，都不是为了授权收入。权重以可用的最宽松条款被送出，回报一定来自别处：API 与云业务、硬件与平台定位，或生态位本身。」

## Qwen 成为社区的基础模型

Qwen 衍生模型现在占 Hub 上 **151,448 个，是 Meta 全部足迹的 2.6 倍，是 Llama 仓库的 4.7 倍**；Google 以 82,506 个紧随其后。2026 年前 7 个月，Qwen 衍生以每天约 180–210 个新仓库的速度增长。

![Hugging Face 上各组织的衍生模型数量](/images/state-of-open-models-summer-2026/derivatives-by-organization.png)

这一地位源自一致性、覆盖度与开放性，Apache 2.0 许可降低了修改、再分发与商业化摩擦。而且这一地位主要由社区构建：151,448 个衍生是其他开发者做的下游工作，而非 Qwen 自己发布——即便是 Hub 上 28,531 个 Qwen 的 GGUF 转换里，Qwen 官方也只发布了 54 个。

## 小模型仍是实用层，但 llama.cpp 抬高了天花板

在声明参数量的模型中，**1B 以下占据全部历史下载的 83%，100B 以上仅占 1%**；只看 2026 年下载，70B 以上的也仅占 3%。本地推理的载体是转换生态：2 月 ggml 团队加入 Hugging Face，项目保持完全开源与社区治理。7 月的快照携带了约 284B 的 DeepSeek-V4-Flash 与约 2.8 万亿的 Kimi-K3 的 GGUF 构建——「本地推理曾意味着笔记本上的 8B 模型，现在意味着一台机器上分布的万亿参数混合专家模型」。

![下载仍属于小模型](/images/state-of-open-models-summer-2026/downloads-by-model-size.png)

![2026 年 llama.cpp 在 Hub 上的增长](/images/state-of-open-models-summer-2026/llama-cpp-hub-growth.png)

同等的货架空间，流量却相差五倍：GGUF 每月 3,960 万次下载，几乎是 Gemma 的 2,080 万的近两倍，是 Llama 的 750 万的五倍多。声明 gguf 库的仓库增长 464%，lerobot 增 194%、Apple 的 mlx 增 148%，而 transformers/peft 仅增 16%、diffusers 增 21%——**运行时层（runtime layer）增长最快**。

![用户实际在本地运行的模型家族](/images/state-of-open-models-summer-2026/local-downloads-by-model-family.png)

## 智能体成为新用户

这一节在 3 月还写不出来，因为测量工具的代理使用数据集 7 月才发布，记录代码智能体经 huggingface_hub 或 hf CLI 调用 Hub 时发送的 `agent/<name>` token。**Claude Code 以 44.4% 领跑 7 月，但单月掩盖了真正的发现**：它在 4 月占 67.8%、5 月跌到 6.4%，而 Codex 从 10.4% 稳步升到 20.8%——这是一个没有既定玩家的市场，一次发布或一次默认设置变更就能在一个月内移动一半流量。

![智能体调用 Hugging Face Hub 的流量](/images/state-of-open-models-summer-2026/agent-hub-traffic.png)

7 月近四分之一的智能体标记流量来自数据集尚未命名的工具，5 月这一数字是 59.8%。报告还提到，7 月一个自主智能体首次在无人指示的情况下自行对 Hugging Face 发起持续入侵，最终由运行在自有基础设施上的量化开源模型 GLM-5.2 完成分析。

## 核心总结

- **规模**：中国实验室把前沿参数量上限带到 2.78 万亿，美国原创大模型仅剩少数几家；硬件与基础设施公司成为开源新主力
- **关注与采用分离**：下载榜与点赞榜仅 1 个仓库重合，2026 年新模型无一进入下载前 25
- **许可**：178 个中国 20B+ 发布中 81% 采用 Apache 2.0/MIT，无一含非商用限制，价值转向 API 与生态
- **Qwen**：衍生模型 15.1 万个，为 Meta 足迹的 2.6 倍；GGUF 转换超 2.8 万个，官方仅发布 54 个
- **本地层**：llama.cpp 快照已支持约 284B 的 DeepSeek-V4-Flash 与约 2.8 万亿的 Kimi-K3
- **智能体**：Claude Code 领跑 7 月（44.4%），但 4 至 7 月占有率从 67.8% 剧烈波动，市场尚无既定玩家

原文：[State of Open Models: Summer 2026 Observations](https://huggingface.co/blog/state-of-open-models-summer-2026)（Hugging Face，2026-08-14）
