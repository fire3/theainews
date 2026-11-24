---
title: "Thinking Machines 发布 Inkling 2 Mini：中间层循环三次，20GB 权重装进笔记本"
description: "Inkling 2 Mini 采用回环 Transformer 架构，26.4B 总参数、3.4B 激活，权重以 NVFP4 原生训练，约 20GB 可在笔记本离线运行；DeepSWE v1.1 得分 48.2%，领先所有百亿级以下开源权重模型。"
pubDate: 2026-11-20
author: "林晓"
category: "models"
tags: ["Thinking Machines", "Inkling 2 Mini", "回环 Transformer", "MoE", "NVFP4", "开源模型"]
image: "/covers/2026-11-20-inkling-2-mini.jpg"
imageAlt: "封面：深炭黑杂志风，超大数字 20GB 与标题「Inkling 2 Mini」，副标题标注 26.4B 总参数、3.4B 激活与中间层循环三次"
topStory: true
---

11 月 20 日，Thinking Machines Lab 发布 Inkling 2 Mini。这是一个总参数 26.4B、每 token 激活 3.4B 的混合专家（MoE）模型，特殊之处在于它是一台「回环 Transformer（looped transformer）」：模型中间的两个区块在生成每个 token 时会被重复执行三次，因此虽然只存了 24 层权重，每个 token 实际经过 48 次层计算。完整权重约 20GB，可在笔记本上离线运行，官方同时开放权重与可变循环深度的研究版本。

## 用循环换推理深度

Inkling 2 Mini 共 24 层，划分为四个六层区块：首块（prelude）与末块各执行一次，中间两块执行三次。团队给出的直觉是，模型中间层承载更抽象推理，首尾层更多用于在词嵌入与内部表示之间做翻译，因此把算力加在中间更划算。

这一判断有实验支撑：在 28 项评测中的 27 项上，循环中间 12 层带来的准确率增益大于循环最后 12 层。训练到第 2,000 步时，若要让无循环基线达到相同的 loss，中间循环版本可折算为 1.51–1.91 倍的计算等效增益，而末段循环只有 1.24–1.36 倍。

循环的接入方式借鉴了 Kimi 团队 2026 年提出的注意力残差（Attention Residuals）：不再把每层输出累加进同一条残差流，而是让每层自行学习读取哪些早期区块的输出。每一轮循环都从 prelude 的输出出发，第二、三轮还会额外读取上一轮中间区块的输出，称作「message」。这个 message 通过一个门控与 prelude 输出合并，而门控在训练初期完全屏蔽 message，使每轮循环的起点与普通模型一致，随后逐步放大增益——这是循环能稳定加入训练的关键。

按团队的说法，回环让模型不必把推理写下来就能想得更久，这直接关系到可监控性：链式思维（CoT）监控依赖模型把中间步骤写成文字，而内部多算几步的部分是看不见的。

## 原生 4 位训练与专家剪枝

模型源自团队主线的预测式缩放阶梯（predictive scaling ladder），24 层结构未变，主要改动是剪掉三分之二的专家并引入循环。

- **训练精度**：从预训练到强化学习，专家层的前向计算全程使用 4 位 NVFP4，配合专用 kernel 与 NVIDIA GB300 的硬件加速；最后四层用 8 位 MXFP8。
- **部署精度**：权重以训练时的数值精度直接发布——20 层 NVFP4、4 层 MXFP8，因此不存在量化转换损失。
- **剪枝与修复**：训练初期稀疏度为 48（从 384 个专家中选 8 个）。中训练阶段一次性剪掉三分之二的专家，每层只保留最常用的 128 个，以压低总参数量、提升速度并适配本地硬件；随后用 1T token（蒸馏自更大的内部 Inkling 模型）训练剩余专家接管被删专家的工作，恢复剪枝前水平。
- **后训练**：SFT 数据配比与 Inkling 2 Small 接近，之后是总计 2.2T token、2,000 步的强化学习，并用同策略蒸馏做对齐。

团队也量化了循环的代价：在未剪枝的同规模对比中，无循环模型训练计算量少 7.5%，但在 512k token 的智能体轨迹上要达到与循环版相同的 loss，推理计算量要多 140%。

## 评测：小模型里的智能体强项

官方称 Inkling 2 Mini 在所有总参数低于 100B 的开源权重模型中领先，尤其在长程智能体与工具调用上。

| 基准 | Inkling 2 Mini | Qwen3.8-27B | 说明 |
| --- | --- | --- | --- |
| DeepSWE v1.1 | 48.2% | 42.2% | 智能体编程 |
| SWE-bench Pro v2 (Hard) | 77.9% | 73.8% | 真实仓库缺陷修复 |
| SWE-bench Verified | 79.2% | 77.8% | — |
| Terminal Bench v2.1 | 71.6% | 73.0% | 弱于 Qwen |
| BrowseComp | 79.0% | 61.6% | 配合上下文压缩 |
| MCP Atlas | 82.7% | 77.3% | 工具调用 |
| AA-Omniscience | -8.6 | -6.4 | 事实性，负分越低越好 |

需要说明的是，表中对比对象是 Gemma 4 31B、Muse Glimmer、Qwen3.8-27B、Nemotron 3.5 Super VL 等模型，评测框架各不相同，官方也标注「评测设置因模型而异」。在核函数优化基准 PMPP-Hard 上，Inkling 2 Mini 拿到 455.82 的 AUC，已接近体量大得多的 Inkling 2 Small。

循环提升的是推理而非记忆。官方明确指出，知识量主要取决于总参数量，循环无法让权重「多存事实」，因此 AA-Omniscience 得分与同尺寸模型相当；而模型靠检索与工具补足知识缺口，在 BrowseComp、DeepSearchQA、MCP Atlas 上处于同类第一。

短板也很明确：多轮对话（MultiChallenge 50.0%）与多约束指令（ComplexConstraints v1.1 33.4%）不如 Qwen3.8-27B，CritPt v2、HLE-Diamond 等重推理基准落后于更大模型。

## 能效与本地演示

斯坦福 Hazy Research 与 Scaling Intelligence 实验室提前拿到了模型，用「每瓦智能」衡量本地推理效率：Inkling 2 Mini 在 NVIDIA DGX Spark 上得分 0.703，高于 Qwen3.6-35B-A3B 的 0.430、Gemma-4-26B-A4B 的 0.159 与 Qwen3.5-27B 的 0.036。该实验以 MXFP8 精度、低推理强度运行，对照组精度为 NVFP4 或 INT4。

演示环节有两个：一位研究员在航班上让模型于飞行模式下的 MacBook Pro（M5 Pro、48GB）离线运行，几分钟内做出一个可玩的飞行模拟器；另一个是「Thinkyville」像素小镇，同一模型在单台离线 MacBook 上同时驱动 20 个村民规划日程、串门与回信。

![Inkling 2 Mini 在飞行模式下的 MacBook 上构建并试玩飞行模拟器](/images/inkling-2-mini-planebench.jpg)

## 循环会不会削弱可监控性

回环架构的隐忧在于：模型可以在不写 CoT 的情况下完成更多推理，而看不见的推理无法被 CoT 监控捕捉。为此团队同时发布了可变循环版本 TML-d24-varloop-research（训练覆盖 1–5 轮，RL 在 3 轮完成），并做了初步分析。

- **无 CoT 能力**：在 Think Fast 基准上，不写推理直接作答的「时间跨度」从 1 轮的 16 秒提升到 3 轮的 37 秒，之后趋于平坦。序列推理基准 N-Hop Lookup 的准确率则一路提升到 10 轮——是训练轮数的两倍，且未见明显退化。
- **CoT 压缩但仍可读**：在 GPQA Diamond 全部答对的题目上，5 轮的推理长度（1,661 token）不到 1 轮（3,703 token）的一半，但句长（8.9→8.7 词）与英文词典词占比（94.6%→94.4%）几乎不变，「wait」「actually」这类犹豫标记从 9.7 降到 3.6。差别在于模型更直接、回退更少。
- **可控性**：在 CoT-Control-QA 上，Inkling 2 Mini 与可变循环版按要求改写自身推理的比例不超过 0.1%，Qwen3.8-27B 为 1.3%。因为都极低，这项评测无法区分不同循环深度。
- **智能体场景**：在 LinuxArena 控制评测中，用强监控模型（Qwen3.8-27B）几乎能拦下全部恶意子任务；换成较弱监控（Qwen3.6-35B-A3B）后会漏掉不少，但未观察到随循环深度变化的趋势。

结论是：在这一规模上，循环提升了「不写出来也能做多少」，但尚未看到推理可监控性的实质下降。团队提醒，更大规模、更依赖隐式思考的架构仍需持续跟踪。他们正与 NDIF 合作让这些模型更易被机制可解释性研究使用，并已向 Goodfire 提供早期访问。

## 如何获取

Inkling 2 Mini 已在 Tinker 上开放推理与微调，也可在 Tinker Playground 对话；完整权重与可变循环版均在 Hugging Face 提供。本地部署方面，任何 32GB 内存以上的 Mac 可通过 Ollama 运行，NVIDIA DGX Spark 可发挥原生 NVFP4 优势，Unsloth 与 llama.cpp 提供量化 GGUF 版本。开源推理支持 SGLang、vLLM、Ollama、NVIDIA Dynamo、TokenSpeed 等，RL 微调支持 SkyRL、Miles 与 NVIDIA AutoModel。

![Thinkyville：同一模型在单台离线 MacBook 上驱动 20 个村民](/images/inkling-2-mini-thinkyville.jpg)

## 核心总结

- Inkling 2 Mini 是 26.4B 总参数、3.4B 激活的 MoE，24 层中中间 12 层循环三次，每 token 实算 48 层
- 原生 NVFP4 训练与部署（末四层 MXFP8），约 20GB 权重，可在 32GB 内存 Mac 上离线运行
- DeepSWE v1.1 48.2%、SWE-bench Pro v2 Hard 77.9%、BrowseComp 79.0%，官方称领先所有百亿以下开源权重模型
- 循环提升多跳推理与长上下文表现，不增加事实性知识；多约束指令与多轮对话仍是短板
- 同步发布可变循环研究模型，初步显示 CoT 更短但依然可读，未见可监控性明显下降

原文：[Introducing Inkling 2 Mini](https://thinkingmachines.ai/news/inkling-2-mini/)（Thinking Machines Lab，2026 年 11 月 20 日）
