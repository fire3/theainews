---
title: "DeepSeek V4.1 Flash 发布：552B 非对称 MoE，KV 缓存降至 1/4"
description: "DeepSeek 发布 V4.1 Flash：552B MoE、非对称 CED 仅激活 8B/16B，KV 缓存累计压缩 437 倍，多项 Agent 基准反超 Opus-5，API 降价。"
pubDate: 2026-09-10
author: "林晓"
category: "models"
tags: ["DeepSeek", "V4.1-Flash", "MoE", "KV Cache", "多模态", "API", "模型发布"]
image: "/covers/2026-09-10-deepseek-v41-flash.jpg"
imageAlt: "深色电影感科技封面：DeepSeek V4.1 Flash 发布，非对称 MoE 与 KV 缓存压缩主题，紫色辉光、左右硬切分栏，标题与关键数据高亮"
topStory: true
---

9 月 10 日，DeepSeek 正式发布 **DeepSeek V4.1 Flash**。作为其「全新模型结构系列」的首个成员，它是一个 552B 参数的 MoE 模型，原生支持多模态视觉输入，上下文最长 100 万 token。凭借全新的非对称 Causal Encoder-Decoder（CED）结构与更激进的 KV 缓存压缩方案，它在多项 Agent 基准上追平甚至反超 Opus-5、GPT-5.6 Sol 等业界旗舰，并同步下调了 API 定价。

## 一图看关键信息

| 项目 | 详情 |
|---|---|
| 模型 | DeepSeek V4.1 Flash（552B MoE，原生多模态，1M 上下文）|
| 激活参数 | 输入（prefill）8B / 输出（decode）16B |
| 模型 ID | `deepseek-flash`（旧名暂时路由）|
| 上线时间 | 2026-09-10 12:00（北京时间）|
| 定价 | 高峰输入 2.0 元、命中 0.04 元、输出 8.0 元/百万 token，闲时半价 |
| 开源 | Hugging Face 权重 + 51 页技术报告已发布 |

## 非对称结构：编码 8B、解码 16B

随模型发布的[技术报告](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf)把压缩成本的思路讲得很清楚：长时程 Agent 让模型负载越来越「重输入」，而 prefill（处理新输入）是成本大头。V4.1 Flash 用 <strong>CED 架构</strong>解决这个问题——40 层网络切成 20 层因果编码器 + 20 层解码器，解码器的全局 KV 由编码器最终隐状态投影而来，大部分 prompt token 可以绕过完整的解码器计算，只保留逐层的滑动窗口注意力。效果是：**prefill 只激活 8B 参数，decode 激活 16B**，输入侧成本几乎减半。

配合训练侧的 FP4 KV 缓存、以及把解码 FLOPs 摊平的 <strong>CSA2</strong> 稀疏注意力，V4.1 Flash 用远比 V4 Pro 更小的规模取得了同级表现。报告给出的基线对比是：<strong>V4 Pro-Base 拥有 1.6T 总参、激活 49B；V4.1 Flash-Base 仅用约 1/3 总参、1/4 激活参数，就在续训评测上拿到 5%–10% 的提升</strong>。预训练语料是 45T token 的多模态语料，稀疏注意力从 64K 序列长度开始「从零训练」，不经过任何稠密注意力热身。

## KV 缓存压缩：890 字节 / Token

KV 缓存是长上下文服务里最吃 HBM 与 SSD 的东西。V4.1 Flash 把这条线打到了极致：**全局 KV 缓存（常驻 HBM）压到 890 字节/token，约为 V4-Flash 的 1/4；持久化 KV 缓存（常驻 SSD/内存）进一步降至约 1/8**。

![DeepSeek 全球 KV 缓存每 token 字节数的演进](/images/deepseek-v41-flash/kvcache.png)

从 DeepSeek-V1 的 389,120 字节到 V4.1 Flash 的 890 字节，**单 token 全局 KV 缓存累计缩小了 437 倍**。这背后是两项关键设计：<strong>CSA2（Compressed Sparse Attention 2）</strong>跨层复用全局 KV 与 Top-K 索引（Full / Reindex / Reuse 三档），以及 **SWA Bounded Replay**——只回放最近 n_win 个 token 就近似重建滑动窗口 KV 状态，换来「不把 SWA KV 落盘 + 少量 prefill 重算」的新权衡。

## Agent 基准：与旗舰对打

官方强调 V4.1 Flash 的能力上限更高、速度更快、吞吐更大，给出的核心依据是 Agentic Benchmark 实测：

![DeepSeek V4.1 Flash 与主流前沿模型在 Agentic Benchmark 上的对比](/images/deepseek-v41-flash/benchmark.png)

关键分数（报告 Table 3）整理如下（单位 %，Pass@1 / Resolved）：

| 基准 | V4.1 Flash | Opus-5 | GPT-5.6 Sol | Kimi-K3 | DS-V4-Pro |
|---|---|---|---|---|---|
| DeepSWE v1.1（Resolved）| **74.2** | 74.0 | 73.0 | 66.9 | 62.7 |
| Terminal-Bench 2.1 | **90.6** | 89.1 | 88.8 | 88.2 | 87.9 |
| Automation-Bench | **54.8** | 50.3 | 45.8 | 48.8 | 43.2 |
| Agents' Last Exam（ALE-CLI）| **31.8** | 28.6 | 26.7 | 27.6 | 25.7 |
| CyberGym | **88.1** | — | 84.5 | 80.0 | 83.3 |
| Terminal-Bench 4.0 | 31.2 | **51.8** | 39.9 | — | 12.4 |

在代码与数学上，其 Codeforces 评级 **3471** 超过 V4-Pro 的 3348 与 V4-Flash 的 3289，MathArena Apex 65.6% 与开源顶流 Kimi-K3 打平，GPQA Diamond 90.9%。多模态侧（Chartography、BabyVision 等）已经超过 Kimi-K3 等开源竞品，但报告也坦承：<strong>在需要专家级领域知识的科学类 Agent 任务（如 Terminal-Bench 4.0）上与超大闭源旗舰仍有差距</strong>。

## 推理强度可调

V4.1 Flash 的 API 提供 low / high / max 三档推理强度（对应论文里的 effort 50 / 75 / 100）。论文里的曲线显示：<strong>把 effort 从 25 提到 100，8 个推理类基准的平均 Pass@1 从 67.1% 升到 76.3%</strong>（DeepSWE v1.1 从 66.0% 升到 74.2%，Terminal-Bench 2.1 从 82.4% 升到 90.6%），代价是约 2.5 倍输出 token；收益集中在 60–80 档，最后的 20 档换 1.6–1.8 倍更长的轨迹、收益趋平——**日常任务用中低档位性价比更高**。

## API 与定价

V4.1 Flash 已同步上线 DeepSeek API，模型名改为 **`deepseek-flash`**。出于兼容考虑，`deepseek-v4-flash` 与 `deepseek-v4-flash-vision-exp` 会被暂时路由到新模型；同时官方计划有序下线 V4 Pro——北京时间 2026 年 9 月 14 日 12:00 之后，`deepseek-v4-pro` 的请求将全部路由到 V4.1 Flash，并按其单价计费。

![DeepSeek-V4.1-Flash API 价格表（单位：元/百万 token）](/images/deepseek-v41-flash/price.jpeg)

定价继续采用峰谷机制，闲时为高峰的一半（高峰时段：工作日 9:00–12:00、14:00–18:00，北京时间；其余含周末为闲时），新价格自 2026-09-10 12:00 生效：

| 计费项目 | 高峰时段 | 闲时时段 |
|---|---|---|
| 输入（缓存未命中）| 2.0 元/M | 1.0 元/M |
| 输入（缓存命中）| 0.04 元/M | 0.02 元/M |
| 输出 | 8.0 元/M | 4.0 元/M |

腾讯（WorkBuddy、CodeBuddy）与 OpenCode 作为官方合作伙伴已全量接入 V4.1 Flash。模型权重与技术报告已发布到 Hugging Face（权重 552B 主模型 + 196B Engram 条件记忆参数）；官方表示将全力支持开源社区推理适配，有 2k 卡 GPU 与存储集群的大规模部署需求可联系 DeepSeek。

核心总结：
- 552B MoE、非对称 CED 结构：prefill 仅激活 8B、decode 激活 16B，原生多模态、1M 上下文
- KV 缓存压缩：全局 890 字节/token（约 V4-Flash 的 1/4），累计较 V1 缩小 437 倍，持久 KV 降至 1/8
- Agent 基准：DeepSWE v1.1 74.2%、Terminal-Bench 2.1 90.6% 等多项对打/反超 Opus-5、GPT-5.6 Sol，Codeforces 3471 分
- API：模型名 `deepseek-flash`，V4 Pro 于 9 月 14 日 12:00 起路由到新模型；高峰输入 2.0 元、命中 0.04 元、输出 8.0 元/百万 token，闲时半价
- 开源：权重与 51 页技术报告已发布，腾讯 WorkBuddy/CodeBuddy、OpenCode 已接入

原文：[DeepSeek V4.1 Flash：更强、更快、更普惠](https://api-docs.deepseek.com/zh-cn/news/news260910)（DeepSeek API Docs，2026-09-10）
论文：[DeepSeek-V4.1-Flash: Pushing the Limits of KV Cache Compression](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash/blob/main/DeepSeek_V41_Tech_Report.pdf)（DeepSeek-AI，2026-09）
