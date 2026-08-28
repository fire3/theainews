---
title: "SGLang Day-0 支持 Qwen3.8-Flash-Next：拆解 QSA 稀疏注意力、IndexShare MTP 与 HyperConnection 内核优化"
description: "SGLang 团队详解 Qwen3.8-Flash-Next 的 Day-0 支持：QSA 稀疏注意力索引开销降 80%，IndexShare 复用 draft 索引，HypCon 内核 2.05× 加速，NVFP4 权重 B200 单请求 540 tok/s。"
pubDate: 2026-08-27
author: "林晓"
category: "tools"
tags: ["SGLang", "Qwen3.8-Flash-Next", "QSA", "稀疏注意力", "推测解码", "MoE", "推理引擎"]
image: "/covers/2026-08-27-lmsys-qwen-flash-next.jpg"
imageAlt: "工程蓝图风封面：浅蓝米白网格底带精密折线与尺寸标注，中央巨大的「6B」深板岩蓝粗体数字与 GPU 芯片正交投影示意，副标题为 Qwen3.8-Flash-Next 每 token 仅激活 6B 参数"
topStory: true
---

8 月 26 日，Qwen 团队开源了 **Qwen3.8-Flash-Next**——一款多模态 MoE 模型，也是 **Qwen4 架构的早期预览**，其之于 Qwen4 的位置，正如 Qwen3-Next 之于 Qwen3.5。**Gated DeltaNet + Gated Attention** 的混合设计从 Qwen3.5 沿用到 Qwen3.8。在与 Qwen、NVIDIA、AMD 团队合作下，**SGLang 为它提供了 Day-0 推理支持**。本文来自 SGLang 团队官方博客，拆解这次支持背后的工程实现。

## 架构升级与支持亮点

Qwen3.8-Flash-Next 在多个方面升级了架构：

- **GDN + QSA 混合注意力**：Gated DeltaNet（GDN）高效压缩历史信息，Qwen 稀疏注意力（QSA）用轻量级索引器在微块（micro-block）粒度挑选重要上下文，让长序列注意力成本保持低位。
- **Gated Residual（GR）**：把残差流拓宽为 4 条分支，并用动态门控控制读写，强化跨层信息流动。
- **N-gram Embedding**：基于局部上下文做查表，为常见短语与局部模式提供额外表示，以极低额外计算扩大模型容量。

SGLang 支持的核心亮点：

- **混合架构**：主模型 125B 参数，外加 51B 的 N-gram Embedding，每 token 仅激活 **6B** 参数。共 48 层：36 层 GDN 线性注意力 + 12 层 QSA 稀疏注意力。MoE 层使用 512 个专家、top-10 路由。
- **自研量化的 NVFP4 检查点**：`RadixArk/Qwen3.8-Flash-Next-NVFP4`，Day-0 同步发布。
- **N-gram Embedding 卸载**：把 N-gram embedding 卸载到主机内存，大幅降低显存占用；异步预取与模型计算重叠，几乎零额外成本。
- **Gated Residual（与 NVIDIA 共建，经 FlashInfer 发布）**：通过低延迟单 GEMM 路径提供高性能 Mix/Combine HyperConnection 算子（**内核级 2.05× 加速**）。
- **GDN+QSA 的 KV 缓存管理**：兼容 Radix Cache。
- **推测解码**：为 MTP draft 模型提供索引复用特性，长上下文下大幅削减 draft 模型的索引器耗时。在 B200 上以 TP4 运行 NVFP4 检查点、batch size 1、开启 MTP 时，解码速度 **540 tok/s**，接受长度 3.3（含 bonus token）。

启动命令与分负载配置指引见 [SGLang Cookbook](https://docs.sglang.io/cookbook/autoregressive/Qwen/Qwen3.8-Flash-Next)。

![Qwen3.8-Flash-Next 架构图](/images/qwen-flash-next/qwen3.8-next-architecture.svg)

## 模型架构

- **GDN+QSA 混合架构**：沿用 Qwen3.5 引入的架构设计，每 4 层中 3 层为 GDN 层（把历史压缩进固定大小的状态），剩余 1 层对全上下文做精确检索。对全局注意力层，Qwen3.8-Flash-Next 进一步引入 QSA，应对「上下文越长、计算与 KV 缓存内存访问成本都大幅上升」的问题。稀疏注意力只关注重要上下文来降低长序列计算；QSA 更进一步：把序列聚合成微块、在块级别估计重要性、再选出最相关的区域，同时降低索引开销与注意力成本。
- **Gated Residual（GR）**：结合了两个思想——沿用 Hyper-Connection 把残差流拓宽为多条分支，并为残差读取引入 GatedNorm 式的逐元素动态门控。原始单条残差流被扩展为 **4 条并行分支**，模型能基于当前内容动态决定每条分支读取多少信息、写回多少。
- **N-gram Embedding**：用「当前 token + 前几个 token」构成的局部上下文做查表，为常见短语与局部模式提供额外表示，几乎不增加每 token 计算开销。它可整体放于主机内存省显存：查表位置提前算好并异步预取，永不常驻 GPU 内存。最终模型只在网络靠前的位置用了**一个 N-gram Embedding 层**，以较低成本加入了大规模「局部模式记忆」。
- **IndexShare MTP**：draft-extend 阶段（对目标刚接受的 token 计算）得到的 QSA top-k 选择被整个 MTP 迭代保留复用，因此每个 draft 解码步都跳过索引器，直接读冻结的选择结果 + 自此之后 draft 出的位置。长上下文下这能大幅加速 MTP draft 步。

## Qwen 稀疏注意力（QSA）：粗检索，精注意力

Qwen3.8-Flash-Next 使用压缩比为 4 的压缩 QSA，即 **c4**。每个 QSA 层有两条路径：轻量级索引器决定「看哪里」，稀疏 GQA 从原始注意力 K/V 缓存中读取被选中的条目。

索引器投影出 4 个 128 维的 query 头和 1 个共享 key 头。每 4 个原始索引 key 在 FP32 下取平均、归一化，并用首 token 的 MRoPE 位置旋转，合成 1 个压缩 key。查询按如下公式给可见的压缩块打分：

$$
s_{t,b} = \frac{1}{\sqrt{128}} \sum_{h=1}^{4} \mathrm{ReLU}\left(\left\langle q^I_{t,h}, \bar{k}^I_b \right\rangle\right).
$$

QSA 保留最佳 512 个块，展开回 2048 个逻辑 token 位置，再附加当前未完成块里的 0–3 个 token。因此最终稀疏注意力最多看到 **2051** 个位置。关键在于，压缩 key 只是索引：最终的 softmax 与 value 聚合使用的是原始、未压缩的 K/V。这意味着 QSA 用一点缓存容量，换来了大幅降低的长上下文计算与内存流量。索引器扫描约 L/4 个小 key，稀疏注意力则只读约 2K 条完整 K/V 条目，而不是全部 L 条目。模型层面的 KV 节省来自混合布局（48 层中只有 12 层存增长型注意力 K/V，其余 36 层 GDN 用固定大小状态），而非在 QSA 层内丢弃 K/V。

SGLang 只把索引器挂到全注意力层，并复用其 MRoPE 实现；原始 K/V 留在普通分页池中。QSA 每 4 个 token 增加 1 个 BF16 压缩索引 key；未完成块的原始 key 放在每请求 4 槽的环形区（ring）里，从而避免为全上下文保留原始索引 key，把 QSA 索引缓存开销降低 **80%**。按页对齐的 `full_slot/4` 寻址让压缩缓存跟随 Radix Cache 所有权、无需独立生命周期。Prefill 阶段用定制 GPU 内核算索引分数、快速 top-k 选块，Triton 展开索引并运行稀疏 GQA；Decode 用分页版同款评分器，压缩选中的原始 K/V 后，Blackwell 上派发到 TRTLLM-Gen、否则用打包的 FlashAttention。索引器可与主 Q/K/V 投影在第二条 CUDA 流上重叠，元数据路径兼容 CUDA graph。

## IndexShare MTP：跨 draft 步复用 QSA 选择

QSA 层先跑索引器挑出要关注的 token，再对这批 token 做稀疏注意力。第二阶段有固定 token 预算；第一阶段则要对全部 ⌈L/4⌉ 个压缩块打分——所以一旦超过几千 token，**决定该层成本的是索引器，而不是它喂给的注意力**。

推测解码会放大这一点：`--speculative-num-steps N` 意味着一次 MTP 迭代要跑 N 次索引器调用（N−1 次 draft 解码前向 + 1 次 draft-extend），才能把 draft 推进最多 N 个位置。因此方案是让 **draft 解码步完全不再跑索引器**。每次 MTP 迭代开头都会对目标刚接受的 token 做一次 draft-extend，那次传递反正要跑索引器——每个请求最后被接受的「行」就在那里被捕获，供整个 draft 循环复用，查表时补上 N+1 列 draft 出来的位置，于是 draft 仍能看到自己进行中的 token。选择结果是一串逻辑 token 索引，请求只会增长、不会越界；且查询最多移动了 N 个位置（整个上下文 L 相比之下很大），复用的选择与索引器本会重算的结果基本一致，接受长度不受影响。这样 **draft 每个 MTP 迭代的索引器工作从 N 次降到 1 次**。那些只为喂给它而存在的小型元数据内核（压缩解码视图、pending-ring 与 group-ring 布局）也随之从 draft 解码步中移除。

## HyperConnection 内核优化

HyperConnection（HC）维护 4 条并行残差流，Attention 与 MoE 则操作单一隐状态。因此每个块用 **Mix** 从四条流读取、用 **Combine** 把输出写回。这里 M 为一次调用处理的 token 数：decode 与推测验证时很小，prefill 时可达数千。SGLang 按 M 分派不同内核。

### Mix

Mix 用低秩投影生成逐元素门控，把四条残差流归约为一个隐状态。

- **M ≤ 16**：使用 FlashInfer [PR #4266](https://github.com/flashinfer-ai/flashinfer/pull/4266) 的低延迟 split-K CuTe GEMM。split-K 把 K 维分区，让多个 CTA 并行处理同一输出区域，弥补 M 维并行度有限的短板。SiLU、Sigmoid、门控与最终归约都融合进两个 GEMM epilogue，避免对全局内存的中间写入。上投影权重被离线重排，使每个输出的 4 个门控值可在 tile 内部局部归约。
- **M 较大**时：用对这些形状更高效的 cuBLAS。

在 NVIDIA B300、M=4 时，融合路径把 Mix 延迟从 12.36 降到 **6.03 µs，内核级 2.05× 加速**；与此前 Triton 路径的端到端推测解码基准相比，吞吐提升 **7.6%**。

### Combine

Combine 计算 4 个注入系数，并对四条流做残差更新。

- **大 M**：单个融合内核一次遍历处理每行。
- **小 M（M ≤ 32）**：这种映射暴露的 CTA 太少，于是把每行沿隐藏维拆分，用双内核实现提供足够并行度，同时保持参考 FP32 累加顺序与**逐位一致的输出**。

在 M=4 时，拆分路径把 Combine 延迟从 4.17 降到 **2.13 µs，内核级 1.96× 加速**；对原来「每个 CTA 处理一行」内核的端到端基准，吞吐提升 **5.49%**。大 M 时融合内核比 cuBLAS 基线快至多 **2.54×**，达到 **6144 GB/s** 有效带宽。形状感知分派让 HC 在低延迟 decode 与大规模 prefill 下都能走合适的执行路径。

## 逐层嵌入（PLE）

该模型把 PLE（哈希寻址的可学习 N-gram 嵌入记忆）放在第二个 decoder 块（配置层 ID 2，对应零基索引 1）。其 **512 亿**嵌入参数（BF16 下约 **95.4 GiB**）是固定模型权重，而非 KV 缓存或可变注意力记忆。对 token $x_t$：8 个 2-gram 哈希头用 $(x_{t-1}, x_t)$、8 个 3-gram 哈希头用 $(x_{t-2}, x_{t-1}, x_t)$，共产生 16 个嵌入行 ID；每行贡献 160 个值，拼接成形状 [2560] 的 $E_t$。稀疏 N-gram 检索被门控进四个 HC 分支，再进入 HC Mix。PLE 维护两个请求局部状态：用于哈希的两个最近 token ID，以及形状 [10240, 9] 的短卷积历史。目标模型在 prefill、decode 与目标验证中均保留 PLE；只有单层 MTP draft 模型禁用它。

PLE 的推导用下列公式描述（$E_t$ 经投影得到 K/V，当前状态 $R_t$ 投影为 Q，门控值加短卷积得到增量 $\Delta_t$，最后注入 HC 状态）：

$$
E_t \in \mathbb{R}^{2560} \longrightarrow K_t \in \mathbb{R}^{4 \times 2560}, \qquad V_t \in \mathbb{R}^{2560}
$$

$$
R_t \in \mathbb{R}^{4 \times 2560} \longrightarrow Q_t \in \mathbb{R}^{4 \times 2560}
$$

$$
g_t = \mathrm{Gate}(\mathrm{Norm}(Q_t), \mathrm{Norm}(K_t)) \in \mathbb{R}^{4 \times 1}, \qquad U_t = g_t \odot V_t
$$

$$
\Delta_t = U_t + \mathrm{SiLU}(\mathrm{DWConv}(\mathrm{RMSNorm}(U_t)))
$$

$$
\widetilde{R}_t = R_t + \Delta_t, \qquad \widetilde{R}_t \xrightarrow{\mathrm{HC\ Mix}} h_t \in \mathbb{R}^{2560}
$$

### 稀疏钉页内存卸载（Sparse Pinned-Host Offload）

因为每个 token 只触碰 16 行，SGLang 把每个 rank 的词汇表并行分片常驻在钉页主机内存中，用 Triton UVA 内核把选中的行收集进一个小的 BF16 显存缓冲；专用 CUDA 流让收集与第一个 decoder 块重叠。既有的 TP 归约与 DP 收集/散布路径保持不变：卸载只改变存储位置，不改变表所有权或 PLE 数学。当有效模型 dtype 为 BF16 时该 CUDA 路径默认开启，独立于 KV 缓存或通用层卸载。

![PLE 数据流与 SGLang 的稀疏钉页主机卸载示意](/images/qwen-flash-next/qwen4-ple-offload.svg)

在 H200 上以 TP4 + MTP-213（2 个 draft 步、top-k 1、每次目标验证 3 个 draft token）的配置下：卸载把目标模型权重从 **83.91 降到 60.45 GiB/GPU（−23.46 GiB）**，在相同显存占比下把可分配的 KV 容量从 **1.84M 提升到 3.28M token（+78.54%）**。以 1/2/4 并发请求测试，匹配吞吐几乎不变（几何均值 **−0.07%**）。四个固定 prompt、各生成 128 个 token 的输出 ID 完全一致；第一种情况记录的 chosen-token logprob 轨迹也完全一致。

## 致谢

这项工作由 RadixArk、Qwen、NVIDIA 与 AMD 的 SGLang 团队协作完成：
- **SGLang 社区**：Qiaolin Yu, Yuhao Yang, Cheng Wan, Xinyuan Tong, Zijie Xia, Ke Bao, Mingyi Lu, Haoguang Cai, Banghua Zhu, Ying Sheng
- **Qwen**：Yi Zhang, Yizhong Cao, Guangda Liu
- **AMD**：Andy Luo, Haichen Zhang
- **NVIDIA**：NVIDIA 与 SGLang 联合优化了 Qwen3.8-Flash-Next 在 Blackwell 与 Hopper 上的性能

原文：[Qwen3.8-Flash-Next: Day-0 Support in SGLang](https://www.lmsys.org/blog/2026-08-26-qwen-flash-next)（LMSYS Org，2026-08-26）
