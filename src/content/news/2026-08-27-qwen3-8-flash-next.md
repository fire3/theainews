---
title: "Qwen 开源 Qwen3.8-Flash-Next：Qwen4 架构先导，训练成本降至约 1/9"
description: "阿里开源 Qwen3.8-Flash-Next：125B 参数、6B 激活，混合注意力与 N-gram Embedding 新架构，原生 262K 可扩 1M 上下文，训练成本约为 Qwen3.7-Plus 的 1/9。"
pubDate: 2026-08-27
author: "林晓"
category: "models"
tags: ["Qwen", "Qwen3.8", "开源模型", "MoE", "混合注意力", "多模态", "1M 上下文"]
topStory: true
image: "/covers/2026-08-27-qwen3-8-flash-next.jpg"
imageAlt: "高对比深色杂志风封面：Qwen3.8-Flash-Next 架构发布，琥珀黄强调色，突出 125B 参数、6B 激活与原生 1M 上下文"
---

阿里 Qwen 团队于 2026 年 8 月 3 日发布 **Qwen3.8-Flash-Next** 的开源权重。作为 Qwen4 架构的先导预览，这是一款多模态 MoE 模型：总计 **125B 参数**、每个 token 仅激活 **6B**，并额外携带 51B 的 N-gram Embedding。相比 Qwen3.7-Plus，其训练成本约为后者的 **1/9**，编码与办公任务能力却更强。

## 架构升级：四个方向

Qwen3.8-Flash-Next 围绕 Attention、Residual、Embedding、Optimization 四个方面系统升级，为 Qwen4 完整模型家族铺路：

- **混合注意力（GDN + QSA）**：延续 Qwen3-Next 确立的 Gated DeltaNet 与全局 Attention 混合设计（每四层三层 GDN、一层全局注意力），并新引入 Qwen Sparse Attention（QSA），以 micro-block 粒度筛选重要上下文。在 1M token 下，QSA 内核在预填充与解码阶段分别实现最高 **7.6×** 与 **4.9×** 的加速；在 90% 前缀缓存命中的设定下，1M 上下文预填充吞吐达到 Qwen3.7-Plus 的 **8.6 倍**；
- **Gated Residual**：把残差流扩展为 4 条并行分支，以动态门控控制跨层信息读写，残差状态可用 FP8 存储，降低访存开销、提升训练稳定性；
- **N-gram Embedding**：结合局部上下文查表，增加 51B 参数而几乎不增加每 token 计算，嵌入表可卸载到 Host Memory 异步预取；
- **Muon 优化器**：围绕正交化精度、Muon 与 AdamW 参数分工、融合矩阵拆分三点调优，并针对新架构重新拟合 Scaling Law；实验发现批量大小预热已无必要，可省去约 18.8% 的优化步数。

## 模型表现与可用性

在 6B 激活参数下，Qwen3.8-Flash-Next-Base 在 14 项基准中的 8 项取得最优成绩，覆盖 MMLU-Pro、SuperGPQA、BBH、GSM8K、EvalPlus、SWEBench-Pretrain、MGSM 与 MMMLU。编码与 Agent 场景同样亮眼：SWE-bench Pro 达到 **62.5**，Toolathlon Verified（Pass@1）为 **73.5**，均优于 Qwen3.7-Plus。

模型原生支持 **262,144 token** 上下文，可通过 YaRN 扩展至 **1M token**。权重已在 Hugging Face 与 ModelScope 发布；默认 1M 上下文、内置官方工具的生产版本以 **Qwen3.8-Flash** 之名在千问AI平台提供服务，定价为每百万 tokens 输入 1 元、输出 3 元。

## 定位与生态

Qwen3.8-Flash-Next 承担的角色与 Qwen3-Next 之于 Qwen3.5 一致：提前释出结构改动供社区检验，为 Qwen4 系列探路。官方将其定位为高并发应用、工具驱动工作流与编程/协同办公助手，并已接入千问办公「标准」模式及 Claude Code、Codex、Qoder、Qwen Code 等生态。

## 核心总结

- **架构**：GDN + QSA 混合注意力、Gated Residual、N-gram Embedding、Muon 优化器四大方向升级
- **规模**：125B 总参数 + 51B N-gram 嵌入，每 token 激活 6B；训练成本约为 Qwen3.7-Plus 的 1/9
- **长上下文**：原生 262K，YaRN 可扩至 1M；1M 预填充吞吐约达 Qwen3.7-Plus 的 8.6 倍（90% 前缀缓存命中）
- **可用性**：权重开源至 Hugging Face 与 ModelScope，生产版 qwen3.8-flash 定价输入 1 元 / 输出 3 元（每百万 tokens）

原文：[Qwen3.8-Flash-Next：全新架构，迈向极致性价比](https://qwen.ai/blog?id=qwen3.8-flash-next)（Qwen Team，2026-08-03）
