---
title: "英伟达发布 Nemotron 3.5 Lightning：开源 30B-A3B 模型专攻智能体执行层"
description: "英伟达开源 Nemotron 3.5 Lightning：30B MoE 仅激活 3B 参数，面向长时智能体高频执行，输出速度最高达同级 4 倍。"
pubDate: 2026-08-12
author: "林晓"
category: "models"
tags: ["NVIDIA", "Nemotron", "MoE", "智能体", "开源模型", "推理优化"]
topStory: true
---

8 月 11 日，英伟达发布开源模型 **Nemotron 3.5 Lightning**，并同步推出模型路由库 **NeMo Switchyard**。这是一款 30B 参数的混合专家（MoE）模型，单次推理仅激活 **3B 参数**，定位是长期运行智能体的"执行层"：处理工具调用、结果校验、子智能体委派等高调用量任务，而把规划与复杂推理交给 Nemotron 3 Ultra 等前沿推理模型。

## 为什么专为长时智能体设计

长期运行的 AI 智能体把大部分算力花在重复性执行上，若每个步骤都调用前沿推理模型，成本与延迟都会失控。Nemotron 3.5 Lightning 的 MoE 路由机制让每个 token 只经过少数专家，以接近小模型的计算成本获得大模型容量；同时针对 OpenClaw、Hermes Agent 等智能体框架做了**框架优化训练**，配套开源安全与管理栈 NemoClaw。

它也是 Nemotron 3 家族中最小的一员，可从 NVIDIA DGX Spark 一路部署到数据中心，并支持 NVIDIA Jetson、GeForce RTX 5090 等本地设备，兼容 LM Studio、llama.cpp、Ollama、Unsloth 等主流推理工具。

## 速度与精度

英伟达称该模型在 Artificial Analysis Intelligence Index 的精度–速度对比中占据 Pareto 前沿：输出速度最高可达同级模型的 **4 倍**。在 PinchBench 上，它以 **86%** 的准确率完成 10,000 项任务，比相近精度的 Qwen3.6 35B 快 **30%**。

速度来自两项核心创新：

- **投机解码**：预训练阶段内置多 token 预测（MTP）并追加专门的 MTP 增强阶段；同时随模型提供 DSpark（推荐 DGX Spark 与低并发场景）和 DFlash 两款草稿模型，MTP 则更适合中高并发场景；
- **量化**：同时发布 NVFP4 与 BF16 检查点，NVFP4 内核覆盖 Blackwell、Hopper、Ampere 三代 GPU，数据中心与本地设备可共用同一文件。

## 开源定制与智能路由

Nemotron 3.5 Lightning 以 **OpenMDW-1.1** 许可开放权重、训练数据与配方，支持 LoRA/全参微调（NeMo Automodel、NeMo Megatron Bridge）与强化学习（NeMo RL、NeMo Gym），并包含开源的智能体强化学习数据集 Nemotron-RL Agentic Terminal Pivot。随模型一同发布的 **NeMo Switchyard** 可将它与其他开源、闭源模型共同纳入路由：规划类请求上送前沿模型，高频执行请求下沉到 Lightning，让 token 预算花得更值。

## 获取方式

模型已在 build.nvidia.com 与 OpenRouter 上线，权重可从 Hugging Face 与 ModelScope 下载，并附有 cookbook 以及 vLLM、SGLang、TensorRT-LLM 部署指南。

## 核心总结

- 30B 总参、3B 激活的 MoE 模型，专攻长时智能体的高频执行层；
- 输出速度最高为同级模型的 4 倍，PinchBench 86% 精度、10,000 项任务比 Qwen3.6 35B 快 30%；
- MTP 投机解码 + DSpark/DFlash 草稿模型、NVFP4/BF16 双检查点；
- OpenMDW-1.1 全开放授权，配合 NeMo Switchyard 实现"规划上送、执行下沉"的模型路由；
- 支持 Jetson、RTX 5090、DGX Spark 本地部署与主流推理框架。

原文：[NVIDIA Nemotron 3.5 Lightning Delivers Fast, Accurate Specialized Task Execution for Long-Running Agents](https://developer.nvidia.com/blog/nvidia-nemotron-3-5-lightning-delivers-fast-accurate-specialized-task-execution-for-long-running-agents/)（NVIDIA Technical Blog，2026-08-11）
