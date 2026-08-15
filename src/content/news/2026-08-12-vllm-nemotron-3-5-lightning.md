---
title: "vLLM Day-0 支持 Nemotron 3.5 Lightning：DSpark 集成与 W4A16 内核优化"
description: "vLLM 首发支持 Nemotron 3.5 Lightning：集成 MTP/DFlash/DSpark 三种投机解码，W4A16 内核提升约 20% 吞吐，可经 OpenAI 兼容 API 部署。"
pubDate: 2026-08-12
author: "林晓"
category: "tools"
tags: ["vLLM", "NVIDIA", "Nemotron", "投机解码", "DSpark", "推理部署"]
topStory: true
---

8 月 10 日，vLLM 团队与 NVIDIA Nemotron 团队联合宣布 **Nemotron 3.5 Lightning 的 Day-0 支持**：模型发布当天即可在 vLLM 上通过 OpenAI 兼容 API 完成生产级部署，连接现有智能体框架与企业自动化系统。与 vLLM 的持续批处理（continuous batching）、前缀缓存（prefix caching）和投机解码能力配合，开发者可在本地设备、边缘、数据中心与云端统一服务这一模型。

## 模型速览

Nemotron 3.5 Lightning 是 30B 总参数、单 token 仅激活 **3B** 参数的混合 MoE 模型，由 Nemotron 3 Ultra 蒸馏而来，上下文窗口最高 **100 万 token**，发布时提供 **BF16 与 NVFP4** 两个检查点。它支持按请求开关推理模式并配置推理 token 预算，且面向智能体框架做了专项训练；官方给出的部署目标覆盖 DGX Spark、DGX Station、RTX PRO/RTX、Jetson，以及 H100/H200/A100/L40S、B200/GB200、B300/GB300 等数据中心 GPU。

## vLLM 为它贡献了什么

模型与 Nemotron 3 架构基本一致，性能工作因此主要落在推理运行时上。vLLM 上游本次合入的关键改动包括：

- **DSpark 集成**：把融合自回归与扩散式草稿的混合投机器接入 vLLM 与 Nemotron 模型定义，与 MTP、DFlash 构成三种可选投机解码；
- **量化草稿头**：DSpark 草稿头量化为 W4A16，在不损失接受率的前提下降低显存占用与每步延迟，对 DGX Spark 这类显存受限设备尤其重要；
- **消除同步与异步调度**：移除草稿–验证循环中的主机–设备同步，当前批次执行时即准备下一批；
- **W4A16 内核后端**：用面向 Hopper 优化的 Humming 后端替换默认 Marlin 后端，为非门控 ReLU2 MoE 提供 W4A16 GEMM 内核（约 20% 吞吐提升），并将同一方案扩展到稠密线性层；
- **ReplaySSM**：为混合架构中的 Mamba2 状态空间层集成 ReplaySSM，降低循环路径的每步开销。

## 三种投机解码怎么选

MTP 使用模型内置的多 token 预测头逐个提出候选 token；DFlash 用扩散式草稿模型并行生成整块候选；DSpark 则结合两者，在速度与 token 接受质量之间取平衡，也是三者在 **DGX Spark 上表现最好的方案**。官方建议：追求低延迟时在 H100、H200 与 DGX Spark 上使用 DSpark；追求当前最大吞吐时**不开投机解码**。DFlash 与 DSpark 的草稿检查点已分别以 `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4-DFlash`、`...-DSpark` 上传 Hugging Face。

## 核心总结

- vLLM 为 Nemotron 3.5 Lightning 提供 Day-0 支持，可经 OpenAI 兼容 API 直接接入现有智能体工作流；
- 上游贡献包括 DSpark 集成、W4A16 量化草稿头、消除同步的异步调度、Humming 内核与 ReplaySSM；
- MTP/DFlash/DSpark 三种投机解码覆盖不同负载，低延迟首选 DSpark、最大吞吐可关闭投机；
- BF16 与 NVFP4 双检查点发布，支持从 Jetson、DGX Spark 到 B300/GB300 的完整部署谱系。

原文：[Announcing Day-0 Support for NVIDIA Nemotron 3.5 Lightning on vLLM](https://vllm.ai/blog/2026-08-10-nemotron-3-5-lightning-vllm)（vLLM Blog，2026-08-10）
