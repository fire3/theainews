---
title: "SGLang 与 Miles 为 Qwen3.8-2.4T-A95B 提供 Day-0 支持：首个开源旗舰的混合注意力挑战"
description: "LMSYS Chatbot Arena 团队宣布 Qwen 最大开源模型 Qwen3.8-2.4T-A95B 获 SGLang 与 Miles 发布日即全面支持，涵盖混合注意力状态管理、PD 分离与 Day-0 RL。"
pubDate: 2026-08-17
author: "林晓"
category: "models"
tags: ["Qwen3.8", "SGLang", "Miles", "LMSYS", "混合注意力", "开源模型", "推理引擎"]
image: "/covers/2026-08-17-qwen3-8-day0-support.jpg"
imageAlt: "深色科技风封面：Qwen3.8 大模型芯片与数据流节点，突出 2.4T 总参数、95B 活跃参数的混合注意力架构与 Day-0 支持主题"
---

LMSYS Chatbot Arena 团队（SGLang & Miles）于 2026 年 8 月 12 日宣布，为 **Qwen3.8-2.4T-A95B** 提供 **Day-0 支持**——即在模型发布当天，SGLang 与 Miles 就能完整运行。这是 Qwen 迄今最大的开源模型：总计 **2.4T 参数**、每个 token 激活 **95B**，而其混合注意力架构颠覆了服务栈对"状态"的大多数既有假设。该工作与 Qwen、阿里百炼、NVIDIA、AMD 团队合作完成，覆盖模型全量能力。

## 架构速览

Qwen3.8-2.4T-A95B 延续 Qwen3.5/3.6 系列的混合注意力设计，规模扩至 2.4T 总参数、95B 激活参数、92 层：

- **混合注意力**：69 层线性注意力（GDN）与 23 层全注意力（GQA）以 **3:1** 交错排布。在线性复杂度与长上下文建模之间取得平衡；
- **GDN（Gated Delta Network）**：线性注意力层组合了状态空间模型（SSM）与因果卷积（CausalConv1d）。固定大小的循环状态替代不断增长的 KV 缓存，每个 GDN 层仅 O(1) 内存、计算复杂度 O(N)；
- **稀疏 MoE**：每个 MoE 层提供 512 个路由专家 + 1 个共享专家，top-k=10 路由。

## 三类服务状态的一致性管理

每个 Qwen3.8 请求同时维护三种服务状态：全注意力层的 **KV 缓存**、GDN 层的**循环状态**、以及 GDN 的**卷积窗口**。前缀缓存、投机解码与 PD（预填充-解码）分离要在三者间保持一致，框架必须在多个子系统内统一处理。

### ReplaySSM 解决 GDN 状态恢复

MTP 验证给 GDN 层带来"状态恢复"难题：验证多个草稿 token 时每层会就地更新循环状态，但只有接受前缀对应的状态应被提交。Qwen3.8 借助 **ReplaySSM** ——验证时记录递推输入而非快照整个 GDN 状态；采样器确定接受长度后，由 fold 内核从提交的检查点重放接受前缀并就地推进状态。实现集成进 FlashInfer 的 CuTe DSL GDN MTP 内核（BF16 状态），验证结果逐位不变，且无可测的验证吞吐回退。同一可变状态缓存路径还让 MTP 能与前缀缓存、重叠调度、PD 分离组合。

### 预填充-解码分离（PD 分离）

PD 分离通过**类型化状态注册表**把三类状态从预填充 worker 移交到解码 worker——每个注册 handler 移动对应状态（KV 缓存、GDN 循环状态、卷积窗口）。每个卷积窗口的 q/k/v 子块跨张量并行 rank 独立分片，传输层按目标布局切片重组。同一载荷还携带 MTP 草稿模型的 KV 缓存、隐藏状态与 top-k 元数据，让投机解码在解码端继续。当预填充与解码使用不同注意力分片布局时，GPU staging buffer 把逐层切片合并成每个 chunk 一次批量 RDMA 传输。

### Radix 缓存与 HiCache

Qwen3.8 使用 SGLang 的 **Unified Radix Cache** 为全注意力 KV 和 GDN 状态提供前缀缓存：FULL 组件管理全注意力 KV，MAMBA 组件管理 GDN 检查点（循环状态 + 卷积窗口聚合）。前向传播修改共享 GDN 检查点前，copy-on-write 会将其恢复到私有请求槽；SGLang 在预填充 chunk 边界与常规解码区间创建新检查点。共享缓存控制器在设备端与宿主端协调 KV 与 GDN 组件，让前缀缓存与 HiCache 能和 MTP、PD 分离组合。

## 性能：8K/1K 帕累托曲线

所有指标为 GB300 上 8,192 输入 / 1,024 输出。PD 分离结果按每活跃 GPU 每秒 token 计（吞吐），低延迟端点给出 TP16 等聚合配置的每用户 token/s：

| 检查点 | 最大吞吐（PD 分离） | 低延迟端点 |
|---|---|---|
| NVFP4（2×PP6 预填充，DP2-attn/TP4/EP8 解码） | 5,126 tok/s/GPU @ 36 tok/s/user | PD: 108 tok/s/GPU @ 334 tok/s/user |
| FP8（2×PP16 预填充，DP4-attn/TP4/EP16 解码） | 3,532 tok/s/GPU @ 30 tok/s/user | Aggregate CC1: 220 tok/s/GPU @ 362 tok/s/user |

**分相并行**：解码端用宽专家并行（EP）分片全部 512 个专家（EPLB 开启）；预填充端用纯流水线并行（PP），每阶段持有一块连续层切片、以全宽 GEMM 执行，无 MoE dispatch/combine/EPLB。分块处理请求让 chunk i 的移交接力与 chunk i+1 的计算重叠——8K 预填充下相比 wide-EP+EPLB 提速 1.53×（FP8）到 1.62×（NVFP4）。

**规避结构性矛盾**：此前流水线预填充与投机解码互斥——嵌入层在第一阶段、LM head 在末阶段，草稿头却同时需要两者。SGLang 把草稿头放在末阶段（带一份其未收到的半段副本）、把草稿 KV 跨 PD 边界与目标 KV 一起分阶段传输，让预填充拓扑成为自由变量。staging buffer 则改变两端的"约定"：预填充把完成的 chunk 写入缓冲并发布 per-peer 水位线，解码端按自己的布局散射出来——只约定 chunk 索引与水位线而非分区，预填充:解码比例、流水线深度、解码 EP 宽度可独立调优。

投机解码（NVFP4、B300、TP8）单请求达到一批 1 时 346 tok/s（MTP、接受长度 3.3）与 378 tok/s（DSpark、接受长度 4），均含奖励 token。匹配的双 PP6 NVFP4 骨干上，加 MTP 令吞吐 +10.0%、每用户速度 ×2.33。

## 内核优化

- **融合 MoE finalize + AllReduce + RMSNorm**：隐藏维度 8192、top-10 路由下，finalize 输入缓冲区在预填充时巨大（8K 输入约需 1.25 GiB），占预填充时间最多 10%。开发团队用 PDL chaining 与持续执行实现融合计算与通信内核，端到端提升超 10%（FlashInfer PR #4358）；
- **上下文并行 GDN 预填充**：把序列分块并行处理，提升长序列/小批量时的 GPU 利用率，预填充性能 +2%–3%（FlashInfer issue #3491）；
- **低延迟单 GEMM 路径**：针对小 GEMM 单独 Split-K 归约内核的延迟，优化后的单 GEMM 路径达约 1.5× 内核级加速、端到端约 4%（FlashInfer PR #4266）；
- **融合 GDN 解码**：融合 SplitKV reshape 与 Conv1D，提升低延迟张量并行配置下解码性能 2%–3%（SGLang PR #32919）。

## Day-0 RL：原生 NVFP4 基座上的 LoRA 训练

Qwen3.8 的 Day-0 强化学习是与 **Miles** 的同置 LoRA 训练：BF16 Megatron 训练器与原生 NVFP4 SGLang rollout 引擎共享同一批 64× GB300，在注意力投影上训练 rank-32 适配器、用 GRPO。团队用一次简短的 GSM8K 训练验证：奖励与评估得分稳定爬升，train/rollout KL 保持平坦。团队还发布了自量化的 **NVFP4 检查点** `RadixArk/Qwen3.8-2.4T-A95B-NVFP4`，启动命令与按工作负载的配置指引在 [Qwen3.8 cookbook](https://github.com/sgl-project/sglang) 中。

## 核心总结

- **架构**：2.4T 总参数 / 95B 激活，69 GDN 线性注意力与 23 GQA 全注意力 3:1 交错，MoE 512 专家 top-10 路由
- **Day-0 状态管理**：KV 缓存 + GDN 循环状态 + 卷积窗口三态一致，覆盖前缀缓存、投机解码与 PD 分离
- **PD 分离达 5,126 tok/s/GPU**（8K/1K），预填充/解码独立布局，staging buffer 解耦两端拓扑
- **内核栈**：融合 MoE finalize（10%+）、上下文并行 GDN、单 GEMM 路径（约 4%）、融合 GDN 解码
- **Day-0 RL**：Miles 同置 LoRA 训练于原生 NVFP4 基座，GSM8K 验证稳定

原文：[SGLang and Miles Add Day-0 Support for Qwen3.8 - LMSYS Org](https://www.lmsys.org/blog/2026-08-12-qwen3-8-day0-support)（作者 SGLang Team，2026-08-12）
