---
title: "独立评测 GPT-6 Astra：代码智能体追平前沿、幻觉骤降，涨价 2.5 倍拖累性价比"
description: "Artificial Analysis 独立评测 GPT-6 Astra：代码智能体追平前沿、幻觉率降一半；但定价涨 2.5 倍，智能指数性价比反被前代反超。"
pubDate: 2026-09-04
author: "林晓"
category: "research"
tags: ["GPT-6 Astra", "OpenAI", "Artificial Analysis", "基准测试", "编码智能体", "评测"]
image: "/covers/2026-09-04-gpt-6-astra-benchmark.jpg"
imageAlt: "深蓝科技风评测封面：金色前沿曲线穿越大片数据浮块、图表与节点光流，寓意模型在性价比与 token 效率之间的权衡"
topStory: true
---

9 月 3 日，独立评测机构 Artificial Analysis 发布了对 OpenAI 新一代旗舰模型 **GPT-6 Astra** 的横向评测，结论"一好一坏"：在**编码智能体指数**（Coding Agent Index）上，它用不到 Fable 5 一半的成本追平了这位头部模型；而在**智能指数**（Intelligence Index）上，它虽然比前代 GPT-5.6 Sol 更省 token，但全线 2.5 倍的涨价把这部分优势完全抵消，单任务成本反而贵出 75%。

## 定价全线翻倍

GPT-6 Astra 的 API 定价为输入/输出每百万 token **10/50 美元**，是 GPT-5.6 Sol 当前 **4/20 美元**的 2.5 倍。缓存读取依旧享受 90% 折扣，缓存写入则加收 25% 溢价。

![GPT-6 Astra 定价整体翻倍：输入/输出每百万 token 升至 10/50 美元（来源：Artificial Analysis）](/images/gpt6-astra/hero-price.png)

## 编码智能体：追平前沿，成本减半

在编码智能体指数中，Codex 环境下的 GPT-6 Astra 拿到 **67 分**，与 Claude Opus 5、Claude Code 中的 Fable 5、Muse Code 中的 Muse Spark 1.3 大致持平；目前领跑的仍是 Claude Code 中的 Fable 5.1（70 分）。

进步的核心是**token 效率**：相比 GPT-5.6 Sol，token 用量削减约 **70%**——max effort 下只消耗前者约三分之一的 token，是 Claude Opus 5（xhigh）的五分之一。落到成本上，GPT-6 Astra 处于「编码指数 × 单任务成本」的**帕累托前沿**：max effort 的每任务成本与 GPT-5.6 Sol（max）相当，指数却高 2 分；为拿到相同分数，每任务成本不到 Claude Fable 5 的一半。

![编码智能体指数的成本改进源于 token 效率：max effort 下 token 消耗约为 GPT-5.6 Sol 的三分之一（来源：Artificial Analysis）](/images/gpt6-astra/coding-token.png)

![GPT-6 Astra 处于「编码指数 × 单任务成本」的帕累托前沿（来源：Artificial Analysis）](/images/gpt6-astra/coding-pareto.png)

## 智能指数：更省 token，却被涨价抵消

在智能指数上，GPT-6 Astra 得到 **61 分**，与 GPT-5.6 Sol 持平，比 Claude Fable 5.1（max with fallback）低 5 分，也落后于 Meta 新发布的 Muse Spark 1.3（max）。它定义了「智能指数 × 输出 token」的新帕累托前沿：max effort 下输出 token 减少约 **10%**。但 2.5 倍的涨价让每任务成本反而比前代贵 **75%**，在智能指数的成本前沿上基本落于 GPT-5.6 Sol 之后。

![GPT-6 Astra 定义「智能指数 × 输出 token」新前沿，max effort 输出 token 减少约 10%（来源：Artificial Analysis）](/images/gpt6-astra/intel-token.png)

![智能指数 × 单任务成本：max effort 下贵出约 75%，基本落于前代之后（来源：Artificial Analysis）](/images/gpt6-astra/intel-cost.png)

## 幻觉率骤降，智能体知识工作喜忧参半

最亮眼的单项是知识幻觉基准 **AA-Omniscience**：max effort 下幻觉率从 92% 降至 **51%**，同时准确率还提高 4 分——并非以牺牲准确率为代价换来的低幻觉。

![AA-Omniscience 大幅跃升：幻觉率从 92% 降至 51%，准确率同步提升（来源：Artificial Analysis）](/images/gpt6-astra/omniscience.png)

面向多周级长周期任务的 **AA-Briefcase** 提升约 **80 Elo**，rubric 得分与分析质量（Analytical Quality）Elo 均显著上涨，但演示质量（Presentation Quality）Elo 反而回落，GPT-5.6 Sol（max）在该项上仍领先所有模型。其余表现则喜忧参半：HLE 提高 6 分，改编自 OpenAI 数据的 **GDPval-AA v2**（覆盖 44 个职业的经济价值任务）却回退约 80 Elo，τ³-Banking、SciCode、AA-LCR 等也有 2–3 分的回落。

![智能体知识工作喜忧参半：AA-Briefcase 提升约 80 分，GDPval-AA v2 回退相近幅度（来源：Artificial Analysis）](/images/gpt6-astra/agentic-knowledge.png)

![智能指数 v4.1.1 各项评测明细（来源：Artificial Analysis）](/images/gpt6-astra/eval-breakdown.png)

## 核心总结

- **编码智能体**：GPT-6 Astra 以不足一半的成本追平头部模型，token 效率提升约 70%，处于成本帕累托前沿
- **智能指数**：得分与 GPT-5.6 Sol 持平，输出 token 减少约 10%，但 2.5 倍涨价使单任务成本贵 75%
- **幻觉**：max effort 幻觉率从 92% 降至 51%，准确率同步 +4 分
- **智能体知识工作**：AA-Briefcase +80 Elo，GDPval-AA v2 约 −80 Elo，其余多项小幅回退

原文：[Benchmarking GPT-6 Astra](https://artificialanalysis.ai/articles/benchmarking-gpt-6-astra)（Artificial Analysis，2026-09-03）
