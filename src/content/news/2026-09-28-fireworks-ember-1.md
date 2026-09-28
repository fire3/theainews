---
title: "Fireworks 发布 Ember-1：在 Kimi K3 上训练，token 用量减少约 40%"
description: "Fireworks Research 发布专用模型 Ember-1：以 Kimi K3 为基座训练，同等质量下 token 用量减少约 40%，成本最多降半，已在 Serverless 上线 Research Preview。"
pubDate: 2026-09-28
author: "林晓"
category: "models"
tags: ["Fireworks AI", "Ember-1", "Kimi K3", "推理效率", "Agentic Coding", "模型蒸馏", "Serverless Training"]
image: "/covers/2026-09-28-fireworks-ember-1.jpg"
imageAlt: "封面：深海军蓝渐变与紫色辉光背景，中央超大亮紫色数字 40%，上方白色标题「Ember-1：同样答案，更少 token」，下方浅灰文字「token 用量减少」与「Fireworks 基于 Kimi K3 训练，单任务成本最多降半」"
topStory: true
---

2026 年 9 月 23 日，Fireworks AI 发布由旗下 Fireworks Research 训练的专用模型 <strong>Ember-1</strong>。它以 Kimi K3 为基座，在不牺牲回答质量的前提下减少冗余推理，官方称 token 用量比 K3 少约 40%，在多个基准上以更低的成本达到甚至超过 K3 最高推理档位（reasoning effort max）的通过率。该模型已在 Serverless 上以 Research Preview 形式提供，与基础 Kimi K3 并列可选。

## 背景：思考模型「想得太多」

Kimi K3 这类推理模型，绝大多数生成 token 花在内部推理而非最终答案上，有时超过 <strong>90%</strong>。单次请求已经昂贵，多轮智能体（Agentic）场景更严重：每一轮都要把此前的推理过程重新送回模型，上下文随轮数近似<strong>二次增长</strong>，早期的长推理轨迹会在后续每次调用中被反复读取和计费。

Fireworks 的实测结论是：这些推理并非都必要。K3 输出的推理长度远超任务所需，多出的部分可以删掉而不影响答案。但直接调低 reasoning effort 并不划算——质量掉得太多。要同时保住质量和成本，只能让模型<strong>学会更高效地推理</strong>，这就必须训练。

## 怎么做的：50 多次训练实验

Fireworks 区分了「有用的反思」与「无谓的推理」：回顾假设、响应反馈、把结果追溯回早先决策，这些自我反思能帮模型纠正错误，需要保留；要削减的是冗长推导和走不出来的死循环。

围绕这一目标，团队在数学、代码、指令跟随、对话、搜索、工具调用与软件工程等任务上构建训练集合，既覆盖单轮问题也覆盖长程交互，用任务反馈引导在线策略学习，强调在各类场景下不丢能力。整个过程在 Fireworks 自家的 Serverless Training 上完成，无需自行调配 GPU。官方披露共运行了 <strong>50 多次训练实验</strong>与 200 多次评测，期间还开发了新的训练算法。训练只使用自有数据，<strong>未使用任何客户数据</strong>。

## 基准测试：成本最高降半

Fireworks 按 Kimi K3 公开 API 定价（未缓存输入 3 美元/百万 token、缓存输入 0.30 美元、输出 15 美元）计算每任务成本，并将 Ember-1 与 K3 的低/高/最高三档推理对比：

| 基准 | 样本数 | K3 最高档 | Ember-1 | 相比 K3 最高档成本变化 |
| --- | --- | --- | --- | --- |
| Terminal Bench 2.1 | 89 | 80.9% | 82.0% | −51.9% |
| SWE-bench Verified | 500 | 93.2% | 92.2% | −15.5% |
| SWE-Interact | 75 | 21.3% | 20.0% | −32.5% |
| DeepSWE 1.1 | 113 | 66.4% | 75.2% | −23.7% |
| τ-2 Bench Airline | 50 | 64% | 66% | −5.9% |

在所有样本数超过 50 的基准上，Ember-1 都位于或接近「质量—成本」帕累托前沿，严格优于 K3 低档；与 GPT-6 Astra、Claude Opus-5、GLM 5.3 对比时同样处于领先位置。在 Fireworks 早前推出的 Specialized Intelligence Index 上，Ember-1 于 Doximity 的临床基准 Bedside Bench（500 个病例、10 个专科）刷新了成本/任务的帕累托前沿。

## 真实流量验证：客户 A/B 与内部无感切换

除基准外，Fireworks 在两个客户的<strong>生产代码负载</strong>上做了线上 A/B 测试，Ember-1 在质量相当的前提下每任务 token 减少约 <strong>35%</strong>，任务完成率、成功分数与失败率等下游指标均持平或改善。测试后，其中一家客户已把 Ember-1 投入生产，并计划进一步替换基础模型。

内部验证中，Fireworks 让自家开发者先在日常编码与智能体工作中使用 Ember-1，没有提前告知。结果显示输出 token 从 49.3K 降至 29.9K（推理 token 减少 71.3%、总 token 减少 39%），而开发者<strong>没有察觉</strong>模型已被替换。

## 后续计划

Ember-1 目前作为 Research Preview 在 Serverless 上线。Fireworks 同时推出「研究版本」机制：为新的研究模型提供两周的 Serverless 访问期，再根据社区需求决定是否转为长期提供；企业也可基于自有数据在 Ember-1 上做定制训练。Fireworks 表示 Ember 只是系列的开始，后续会继续推出面向不同负载的专用模型。

## 核心总结

- <strong>定位</strong>：Fireworks Research 以 Kimi K3 为基座训练的专用模型，主打「同样答案、更少 token」
- <strong>效果</strong>：token 用量约减少 40%，在 SWE-bench Verified、Terminal Bench 2.1 等基准上达到或接近 K3 最高档质量
- <strong>成本</strong>：按 K3 公开定价计算，单任务成本相比 K3 最高档下降 5.9% 至 51.9%
- <strong>方法</strong>：保留有价值的自我反思、削减冗长推理与无效循环，50 多次训练实验、200 多次评测
- <strong>验证</strong>：客户生产负载 A/B 每任务 token 减少约 35%，内部开发者切换后无感知
- <strong>可用性</strong>：Serverless 上以 Research Preview 提供，支持企业用自己的数据定制

原文：[Introducing Ember-1](https://fireworks.ai/blog/ember-1)（Fireworks AI，2026-09-23）
