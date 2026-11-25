---
title: "PrismML 发布三元 Bonsai 2.5 27B：5.9GB 权重，智能体编程追至满血版九成"
description: "PrismML 发布三元 Bonsai 2.5 27B：体积仍 5.93GB，智能体编程保留满血版 90%，工具调用均值 77.2 逼近 FP16。"
pubDate: 2026-11-25
author: "林晓"
category: "models"
tags: ["PrismML", "Bonsai", "三元量化", "本地部署", "智能体", "Qwen"]
image: "/covers/2026-11-25-ternary-bonsai-2-5-27b.jpg"
imageAlt: "封面：深炭黑高对比杂志风，青绿斜切分栏，标题「三元 Bonsai 2.5 27B」配副标题 5.9GB 权重、SWE-bench 75.6、H100 291 tok/s"
topStory: true
---

11 月 24 日，PrismML 发布 Ternary Bonsai 2.5 27B，作为两个月前 Ternary Bonsai 2 27B 的升级版本。新模型沿用 Qwen3.8 27B 的混合注意力架构和三元权重格式，体积仍是 5.93 GB、1.76 bit/权重，但把优化重心从「能跑起来」转向「能连续干活」：多轮工具调用、长序列智能体编程和多步任务执行。官方称其为「同等内存占用下最强的智能体模型」。

## 压缩格式没变，补的是行为

从系统规格看，2.5 版几乎是原地升级。参数量为 24.35B 语言模型（64 层）加 0.47B 视觉塔（27 层）与 2.54B 嵌入及 lm-head，合计 27.36B；权重是 {−1, 0, +1} 三元值配 FP16 分组缩放（g128），存放在块状 Hadamard 基下，对应 1.76 bit/权重、5.93 GB 的 PTQ1_0 文件，而 FP16 原模型为 53.8 GB，压缩比约 9 倍。上下文窗口 262K，提供 xhigh（默认）与 medium 两档推理强度，许可证仍是 Apache 2.0。

真正的变化发生在训练与行为层面。官方表示这一版专门处理了上一代「过度思考」与重复循环的问题，在同样的任务上能用更少的轮次、更少的 token 完成，结果也更快、更准。对智能体工作流而言这不是锦上添花：连续几十次工具调用里，单步的小错误会逐步累积，最终让整个任务跑偏，因此「少走弯路」本身就是可用性。

## 智能体编程：保留率从 63% 提到 90%

压缩通常最先伤到的就是智能体编程。PrismML 用三个编码基准衡量：SWE-bench Verified、Terminal-Bench 2.1 与 DeepSWE v1.1。

| 基准 | Qwen3.8 27B（FP16） | Bonsai 2 27B | Bonsai 2.5 27B |
| --- | --- | --- | --- |
| SWE-bench Verified | 80.6 | 60.8 | 75.6 |
| Terminal-Bench 2.1 | 70.8 | 52.8 | 60.1 |
| DeepSWE v1.1 | 30.1 | 0.0 | 27.0 |
| 三项平均 | 60.5 | 37.9 | 54.2 |

上一代在这三项上只保留了 FP16 的 63%，且在 DeepSWE 上一题未解；2.5 版把保留率拉到 90%。其中 SWE-bench Verified 恢复到 FP16 的 94%，DeepSWE 从 0 直接跳到 27.0，接近满血版的 30.1。Terminal-Bench 2.1 是三者中差距最大的，60.1 对 70.8。

## 工具调用：五项均值基本追平

在 τ²-Bench、τ³-Bench、BFCL v3、BFCL v4 与 AppWorld 五个工具调用基准上，Bonsai 2.5 平均 77.2，FP16 为 77.7，上一代是 67.0。

| 基准 | Qwen3.8 27B（FP16） | Bonsai 2 27B | Bonsai 2.5 27B |
| --- | --- | --- | --- |
| τ²-Bench | 80.6 | 80.2 | 82.0 |
| τ³-Bench | 72.8 | 69.1 | 73.9 |
| BFCL v3（原生工具调用） | 71.2 | 70.3 | 72.6 |
| BFCL v4 | 70.8 | 64.4 | 67.2 |
| AppWorld | 93.2 | 51.2 | 90.5 |
| 五项平均 | 77.7 | 67.0 | 77.2 |

提升最明显的是 AppWorld：需要对着九个日常应用的 API 写代码，Bonsai 2 只有 51.2，2.5 到 90.5，已接近 FP16 的 93.2。在需要多轮对话式服务的 τ²-Bench 和 τ³-Bench 上，2.5 版甚至小幅超过满血模型。唯一的退步项是 BFCL v4，比 FP16 低 3.6 分。

## 比常规低比特量化更小，却更强

PrismML 把 2.5 版和同一基座模型的常规低比特 GGUF 构建放在一起比较，包括 GSQ-RCO 的 IQ3_XXS、IQ2_S、IQ2_XS 与 Unsloth Dynamic 的 UD-IQ2_XS。

| 构建 | 文件大小 | bit/权重 | 工具调用均值 | 编程均值 |
| --- | --- | --- | --- | --- |
| Qwen3.8 27B FP16 | 53.8 GB | 16.0 | 77.7 | 60.5 |
| GSQ-RCO IQ3_XXS | 10.1 GB | 3.00 | 75.3 | 55.5 |
| GSQ-RCO IQ2_S | 9.3 GB | 2.75 | 74.1 | 52.5 |
| GSQ-RCO IQ2_XS | 8.4 GB | 2.50 | 65.6 | 48.5 |
| Unsloth UD-IQ2_XS | 7.6 GB | 2.27 | 75.3 | 47.8 |
| Ternary Bonsai 2.5 27B | 5.93 GB | 1.76 | 77.2 | 54.2 |

Bonsai 2.5 是这一组里最小的，却在 10 GB 以下的所有构建中同时拿下工具调用与智能体编程的第一。对体积 1.7 倍的 IQ3_XXS，它工具调用领先 2 分，编程略低 1.3 分。值得注意的是「IQ2」这类命名与实际比特数并不对应：这些文件实际是 2.27 到 2.75 bit/权重，比 Bonsai 2.5 多 29% 到 56% 的体积，分数却更低。

更值得警惕的是失效方式。GSQ-RCO IQ2_XS 在 τ²-Bench 上有 79.5，但 AppWorld 只有 46.5；白皮书描述，在约五分之一的任务里，它会写一大段脚本把每个 API 调用都猜一遍，然后在没看任何输出之前就把任务标记为完成。这类失败在单轮基准上几乎看不出来，只有放进真实的多步执行才会暴露。

## 通用能力与速度

在知识、数学、编程、指令遵循与视觉五个类别、共 14 项基准上，Bonsai 2.5 平均 82.3，FP16 为 84.4，是所有压缩构建中最高的，也是唯一在每个类别都与满血版相差不到 4 分的版本；最大差距出现在数学，为 3.1 分。指令遵循和视觉是相对弱项，IQ3_XXS 与 IQ2_S 最多领先 1.1 分。

速度上这一版补了关键一环：每个 GGUF 文件都内置了多 token 预测（MTP）草稿头，由主模型一次性校验草稿，NVIDIA GPU 上解码提速 1.5 到 1.8 倍，输出与不开草稿的差异仅在舍入噪声量级（H200 上 PTQ1_0 的平均 KL 散度为 5.2×10⁻⁵）。

- 官方博客口径：单张 H100 带 MTP 达 291 tokens/s，2000 token 提示词的预填充为 3200 tokens/s；RTX 4090 上为 204 tokens/s，预填充约 3060 tokens/s。
- 白皮书纯解码数据（不开 MTP）：H200 189、B200 192、H100 186、RTX 5090 163 tokens/s，较 9 月发布版提升 1.1 到 2.1 倍。
- 代价是 MTP 自己要过一遍提示词，NVIDIA 上预填充会慢 9% 到 23%；把仍在测试的 kernel 计入后，带 MTP 的预填充反而全面反超。

生态上，Q2_0 文件已能在原生 llama.cpp 运行，运行时支持以 PR #29600 合入，所需的块状 Hadamard（FWHT）kernel 已在 CPU、CUDA、Metal、Vulkan、SYCL、MUSA 上游落地，PTQ1_0 格式仍在评审中。Apple 侧提供 MLX 文本版，与 llama.cpp 的输出高度一致，在 M5 Pro 上预填充 348 tokens/s、解码 21.7 tokens/s。

## 局限

白皮书列出的边界相当坦率：Terminal-Bench 2.1 仍是与 FP16 差距最大的智能体基准，而现有评测都是时长有限的单任务回合。真正长周期的工作——机器学习工程（MLE-bench）、长时间自主运行（VendingBench）、更难的多语言仓库任务（SWE-bench Pro）——尚未测量，官方称这是下一版的重点。kernel 与 KV cache 的路线图也延续上一版：让 PTQ1_0 在各目标硬件上与 PQ2_0 一样快、做 4 bit 以下的 KV cache、去掉 batch size 为 1 时激活侧的旋转开销。

## 核心总结

- Ternary Bonsai 2.5 27B 沿用 Qwen3.8 27B 架构与三元权重格式，1.76 bit/权重、5.93 GB，约为 FP16 的 1/9，Apache 2.0 许可
- 智能体编程三项平均保留 FP16 的 90%（上一代 63%），DeepSWE 从 0 升至 27.0，SWE-bench Verified 从 60.8 升至 75.6
- 工具调用五项均值 77.2，逼近 FP16 的 77.7；AppWorld 从 51.2 跃升至 90.5，仅 BFCL v4 落后 3.6 分
- 体积小于所有对比的常规低比特 GGUF 构建，却在 10 GB 以下同时领先工具调用与智能体编程
- 每个 GGUF 内置 MTP 草稿头，NVIDIA 解码提速 1.5 到 1.8 倍；Q2_0 已可在原生 llama.cpp 运行
- 长周期自主任务（MLE-bench、VendingBench、SWE-bench Pro）尚未评测，Terminal-Bench 2.1 仍是最大差距项

原文：[Introducing Ternary Bonsai 2.5 27B: Powering Agentic Coding and Private Knowledge Work](https://prismml.com/news/bonsai-2-5-27b)（PrismML 官方博客，2026 年 11 月 24 日）
