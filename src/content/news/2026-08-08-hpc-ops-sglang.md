---
title: "HPC-Ops × SGLang：腾讯混元开源三大推理算子进主分支"
description: "腾讯混元开源 HPC-Ops 已合入 SGLang：动态负载均衡 Attention 与精度感知 Router GEMM，Hy3 的 TPOT 最高降 48.8%。"
pubDate: 2026-08-08
author: "林晓"
category: "research"
tags: ["HPC-Ops", "SGLang", "腾讯混元", "MoE", "推理优化", "Attention"]
image: "/covers/hpc-ops-sglang.jpg"
imageAlt: "腾讯混元三大推理算子合入 SGLang 主引擎的抽象插画"
---

腾讯混元（Hunyuan）AI 基础设施团队与 SGLang 团队联合宣布，混元生产环境自研的算子库 **HPC-Ops** 已集成进 SGLang 主分支。这套为大规模 LLM 推理打磨的算子，把混元里"在线推理关键路径"上的三大优化——工作负载感知的 Attention 调度、精度感知的 Router GEMM、融合的 MoE 流水线——一起带给了开源推理社区。

效果最直观的一个数字：在 8× NVIDIA H20 上跑 Hy3-FP8 推理，同时启用 HPC-Ops 的 Attention 与 MoE，批大小在 4–64 时把 **TPOT 降低了 15.1%–48.8%**，批大小 4–16 时让 **TTFT 降低 3.3%–9.0%**。

## 关键要点

- 腾讯混元开源算子库 HPC-Ops 已合入 SGLang 主分支，目标 NVIDIA Hopper（SM90）GPU，用 Qwen3、Hy3、LongCat 工作负载验证
- **Dynamic Attention**：用"常驻内核 + 按实时 KV 长度切 64-token 瓦片动态调度"取代静态 split-KV，混合长度解码平均比 FlashInfer / FlashAttention 中的最优者快 2.25×，H20 上最高 2.95×
- **Router GEMM**：把 FP32 权重拆成两个 BF16 分量，在两份 BF16 GEMM 上恢复接近全精度，比 FP32 cuBLAS 快 1.30–3.22× 而数值误差小两个数量级
- **Fused MoE**：融合"路由索引 + Gate-Up + 激活/重量化 + Down + 归约"的低延迟流水线，Hy3 上比 SGLang/vLLM 最优基线平均每批快 1.08×（TP8/EP1）与 1.21×（TP1/EP8）

## MoE 推理服务的三条关键路径

生产中的 MoE 服务几乎不会遇到内核基准里那种均匀负载。它在同一条对延迟敏感的路径上，混合了不同长度的 Attention 计算、对精度敏感的路由，以及稀疏的专家执行；长上下文、多轮对话和智能体负载还会进一步拉大实时 KV 长度的分布。所以，服务性能不只是原始矩阵乘法的吞吐，还包括工作负载均衡、数值保真度和开销控制。

这些约束集中在三个性能关键阶段：

- **解码阶段的 Attention**：计算量随每个请求实时 KV 长度增长，混合长度批次成了一个负载均衡问题
- **Router GEMM**：产出用于 top-k 选择的分数，微小的数值变化就可能改变选中的专家
- **被选中专家的小型不均衡 GEMM**：元数据构建、token 搬运、中间存储和启动开销，足以和专家 GEMM 本身的计算量抗衡

HPC-Ops 为每个阶段各写了一个专门算子，并借着 SGLang 的原生后端与调度接口把它们接到服务运行时上。

## Attention：混合长度解码的负载均衡

解码阶段每个新 token 都要对整个请求的 KV 缓存做注意力计算，所以计算量随实时序列长度增长——缓存 16K token 的请求，KV 计算量大约是 1K 请求的 16 倍。生产里提示词和输出长度差异很大，连续批处理又会把处于不同生成阶段的请求塞进同一次启动，于是一个批次常常混合了短 KV 缓存和长达数万 token 的序列。

静态 split-KV 调度把工作映射到"KV 头 × 请求 × KV 块"的固定启动网格上，整个批次共享同一种分区策略，在混合长度批次上表现不佳：

- 固定拆分数量时，长请求产生更重的块，短请求的 CTA 早早结束，少数持续运行的 CTA 决定了内核尾部延迟
- 固定块大小时，网格必须为最长请求预留足够的拆分，短请求出现空块或近乎空块，却仍占用调度槽位

一句话，一种策略造成工作不均衡，另一种策略调度了并不存在的工作。

### 围绕实时 KV 工作负载来调度

HPC-Ops 用常驻内核取代静态的逐请求拆分，根据批次的实际长度分布，在 CTA 之间动态均衡 KV 瓦片。每个解码批次，一个分配内核按实时 KV 长度构建全局任务映射：

1. 把每个序列切成统一的 **64-token 瓦片**，汇总所有头和请求的瓦片数，除以常驻 CTA 的数量，得到每个 CTA 的瓦片预算
2. 分配内核把每个 CTA 的容器填满至该预算，再溢出到下一个容器——长序列按长度比例跨越多个 CTA，短序列只贡献它实际拥有的瓦片
3. 总工作量小时，最低工作量下限防止过度分区，压低下游合并开销

任务映射在每个解码步骤根据设备端序列长度生成一次，并在 Transformer 各层之间复用，摊薄成本。执行阶段每个 CTA 清空自己分到的分箱，对连续 KV tile 算 Attention 并连同 log-sum-exp 统计量写出部分输出，常驻 CTA 继续处理下一条描述符直到分箱清空；最后的合并内核按实际块数在正确的全局 softmax 归一化下合并。近乎均等的分箱让各 CTA 大致同时完成，消除了少数异常长请求引发的内核尾部效应。

对 Hy3 FP8，HPC-Ops 还把 Attention 前奏融合进 QKV 投影之后：在 RoPE 前做 QK-Norm、按 token/头缩放把 Q 输出成 FP8，K、V 直接写入分页 FP8 缓存，量化后的 Q 连同缩放因子直接喂给主 Attention 内核，避免重新量化——省去了中间张量及其 HBM 往返和各自独立的内核启动。

## Router GEMM：在路由精度和吞吐之间权衡

Router 精度直接影响 MoE 模型质量。每个 MoE 层把隐藏状态投影成专家得分，再做 top-k 选择；第 k 与第 k+1 名专家之间得分差可能很小，所以这个投影的算术精度决定了选对专家与否。为此，一些生产模型即使在隐藏状态是 BF16 的情况下仍保留 FP32 的 router 权重。

把权重降成 BF16 能启用 BF16 Tensor Core 吞吐，但会丢可能改变 top-k 决策的低位尾数位；完整的 FP32 GEMM 保住了全部精度，却用不满 Tensor Core 的吞吐。

### 一种精度感知的 BF16 分解

HPC-Ops 的做法是把 FP32 权重拆成两个 BF16 分量：直接截断出 BF16 高位部分，再用缩放残差构成第二个 BF16 分量，原权重近似为两者之和。于是矩阵乘积变成两次 BF16 GEMM，结果经缩放校正后合并，恢复低阶尾数的贡献：

```text
W ≈ W_high + (W − W_high) × 256
  ≈ W_high + W_low / 256
```

单个内核同时在共享内存里加载激活块、在 FP32 寄存器累加两份部分结果、收尾阶段应用缩放、把最终 FP32 路由分数写回全局内存——主计算跑在 BF16 Tensor Core 上，却能恢复接近全精度 FP32 的精度。

框架层，SGLang 在模型加载时缓存分解好的权重对，并在请求与 CUDA 图重放之间复用；一个感知形状的调度器会在实测交叉点处选 HPC-Ops 内核或默认路径——交叉点以下，单次 FP32 路径更快，因为双乘积的开销超过了 Tensor Core 的增益。

## MoE：压低小专家 GEMM 周围的额外开销

解码阶段每个专家只收到少量 token，产生的专家 GEMM 小且受内存带宽限制，SM 利用率不足；负载不均衡又让路由到各专家的 token 数随专家、随步骤变化，更难均匀分布到可用 SM。

更关键的是专家 GEMM 周边的开销。传统 MoE 路径把路由、收集 token 到各专家缓冲区、Gate-Up GEMM、激活与量化、Down GEMM、top-k 加权归约回 token 位置串成多个独立内核。收集步骤在矩阵乘法开始前就在 HBM 中物化出完整 token 张量，后续每个阶段都背着自己的内核启动和中间结果往返。当 GEMM 规模很小时，这些周边开销占掉了该阶段相当比例的墙钟时间。

### 融合、面向延迟的 MoE 流水线

低批次推理场景下，HPC-Ops MoE 后端围绕"任务映射驱动的常驻专家 GEMM"构建低延迟流水线：

- **路由与索引构建**：从选中 top-k 专家 ID 出发，用共享内存计数遍历把 token–专家分配整理成连续、按专家划分的输出区间，降低全局原子压力，并产出供常驻 GEMM 直接消费的路由索引和按 tile 划分的任务映射
- **Gate-Up 与激活**：Gate-Up GEMM 通过路由索引直接读原始 token，省掉独立的 gather 操作和额外 HBM 流量；随后 SiLU-相乘与 FP8 重量化作为单个融合内核运行，输出由 Down GEMM 直接读取
- **以占用率为先，不搞 warp 特化**：单个 warp 组同时负责数据搬运和矩阵运算，提高 CTA 驻留率，把内存延迟隐藏从 CTA 内软件流水线转移到跨 CTA 硬件调度
- **PDL 链式阶段**：用 Programmatic Dependent Launch 把每个下游内核的启动与前一阶段尾部重叠，缩小 Gate-Up、激活、Down 与最终 top-k 加重归约之间的间隙

这些优化共同砍掉了关键路径上的中间流量与内核启动开销。

## 从 HPC-Ops 内核到 SGLang

通过 SGLang 的原生后端与调度接口，HPC-Ops 直接复用服务运行时已有的状态，同时保持为独立维护的算子库：Attention 直接用分页 KV 存储和实时设备端序列元数据、无需额外布局转换；Router GEMM 在请求间和 CUDA 图重放时复用预处理后的权重与工作区；MoE 遵循 SGLang 的专家 ID 与分区方式、无需重映射。

| 算子 | 优化内容 | 精度 | 上游 PR |
|---|---|---|---|
| Attention | 负载均衡的混合长度解码 + 融合 QK-Norm、RoPE、量化、KV 写入前序 | BF16 激活；BF16 或 FP8 E4M3 KV cache | #30540、#32304 |
| Router GEMM | BF16 Tensor Core 精度感知路由投影，保留 FP32 权重信息 | BF16 激活 × FP32 权重 → FP32 分数 | #30247、#31943 |
| MoE | 面向小型不均衡专家 GEMM 的低开销执行 | BF16 隐藏状态；FP8 E4M3 专家权重 | #30541 |

## 性能数字

### H20 算子基准

**Attention**：动态调度的优势在混合长度解码里最明显（表中的 A×B 表示 A 个请求、每个 KV 长度 B）。随数据偏斜度增加，动态相对静态的增益从均匀 64×0.5K 批次的持平，一路升到 1×128K+31×4K 场景的 2.95×；全部六种情况下，动态平均比 FlashInfer 和 FlashAttention 中的最优者快 2.25×。

| 解码场景 | HPC 动态 | HPC 静态 | FlashInfer | FlashAttention | 动态 vs 静态 |
|---|---|---|---|---|---|
| 64×0.5K | 0.013 ms | 0.013 ms | 0.050 ms | 0.025 ms | 1.00× |
| 64×4K | 0.033 ms | 0.043 ms | 0.221 ms | 0.095 ms | 1.32× |
| 32×0.125K+32×4K | 0.020 ms | 0.033 ms | 0.119 ms | 0.053 ms | 1.59× |
| 2×32K+30×4K | 0.032 ms | 0.056 ms | 0.169 ms | 0.094 ms | 1.76× |
| 1×64K+15×4K | 0.042 ms | 0.097 ms | 0.118 ms | 0.065 ms | 2.32× |
| 1×128K+31×4K | 0.063 ms | 0.186 ms | 0.220 ms | 0.097 ms | 2.95× |

**Router GEMM**：在 K=4096、N=192 的通用扫描里，HPC-Ops 比 FP32 cuBLAS 快 1.30–3.22×、比 TF32 cuBLAS 快 1.25–1.78×；以 FP32 cuBLAS 为数值参考，最大绝对误差保持 0.00177 或更低，而 TF32 的误差是 0.06464——差了两个数量级。放到 SGLang 的模型感知调度范围内，LongCat-Flash 的 Chat 形状实现 1.06–2.83× 加速，Lite 形状实现 1.09–2.46× 加速。

**MoE**：以每行三个基线（SGLang、vLLM Triton、vLLM CUTLASS）里的最低延迟为基准，HPC-Ops 在 Hy3 上平均每批实现 TP8/EP1 配置 1.08×、TP1/EP8 配置 1.21× 的加速，收益在低延迟解码常见的中小批次下最大。

### 端到端推理

在 8× NVIDIA H20 上，<strong>Hy3-FP8（TP8 + FP8 KV cache）</strong>同时启用 HPC-Ops Attention 与 MoE，8K 输入、4K 输出：

| Batch | SGLang 默认 TPOT | HPC-Ops TPOT | 提升幅度 |
|---|---|---|---|
| 1 | 7.56 ms | 7.31 ms | 3.3% |
| 4 | 11.10 ms | 9.42 ms | 15.1% |
| 8 | 14.29 ms | 10.76 ms | 24.7% |
| 16 | 22.90 ms | 13.09 ms | 42.8% |
| 32 | 35.33 ms | 18.09 ms | 48.8% |
| 64 | 40.70 ms | 23.81 ms | 41.5% |

同样 8K 输入下，batch 1–16 的 TTFT 提升 3.3%–9.0%；batch 16、禁用 chunked prefill 与 prefix caching、把输入从 2K 扫到 8K 时，TTFT 提升 2.3%–8.9%。在 LongCat-Flash-Lite-FP8 上单独启用 Router GEMM（1,024 输入 / 128 输出），input-wise 吞吐在 batch 1 时基本持平（+0.5%），batch 4–64 时提升 5.5%–6.1%。

### H200 验证与保真度

上游 PR 还在 H200 上报告了结果，说明收益在 Hopper GPU 上有普适性：

| 算子 | 上游验证 | 结果 |
|---|---|---|
| FP8 Attention | Hy3-FP8 + FP8 KV cache，混合长度 | 输出吞吐 +2.0%；TTFT −5.3% |
| BF16 Attention | Qwen3 + BF16 KV cache | 输出吞吐 +3.0%；TPOT −2.8% |
| Router GEMM | LongCat-Flash Chat/Lite | 内核加速 1.56–4.31× |
| MoE | Qwen3 FP8，token 1–4096 | 内核加速 0.89–4.21× |

模型级服务验证：Hy3-FP8 的 Attention 对比 FlashAttention 输出吞吐 +3.7%–5.9%；LongCat-Flash Lite 预填充的 Router GEMM 输入吞吐 +2.8%–5.4%；MoE 在 Qwen3 上输出吞吐从持平到 +2.7%、Hy3 上 −4.2% 到 +6.3%。

保真度检查同样重要：Attention 测试在 BF16 和 FP8 下均通过、Hy3 FP8 贪心输出与 BF16 路径逐 token 完全一致；Router GEMM 对比 FP32 参考并保持贪心输出一致；Qwen3 的 HPC-Ops MoE 与 Triton 在 FP32 下误差水平相当（余弦相似度 0.99974、最大相对误差 0.024）。

## 快速开始

从源码安装 HPC-Ops（也内置在 SGLang 官方 x86_64 开发镜像 `lmsysorg/sglang:dev` / `lmsysorg/sglang:dev-cu12` 里）：

```bash
git clone https://github.com/Tencent/hpc-ops.git
cd hpc-ops
make wheel
python3 -m pip install dist/*.whl
```

同时启用 Attention 与 MoE 两个后端并打开 FP8 KV cache：

```bash
python3 -m sglang.launch_server \
  --model tencent/Hy3-FP8 \
  --tp-size 8 \
  --attention-backend hpc_ops \
  --kv-cache-dtype fp8_e4m3 \
  --page-size 64 \
  --moe-runner-backend hpc_ops
```

想用 BF16 KV cache 就省略 `--kv-cache-dtype fp8_e4m3`，只用一个算子就只指对应的后端。Router GEMM 会为受支持的模型和路由形状自动选择启用，装好 HPC-Ops 后用标准 LongCat-Flash 启动方式即可：

```bash
python3 -m sglang.launch_server --model meituan-longcat/LongCat-Flash-Lite-FP8
```

## 核心总结

- **事实**：腾讯混元 HPC-Ops 的 Attention、Router GEMM、MoE 三算子已合入 SGLang 主分支，面向 Hopper GPU
- **Attention**：常驻内核 + 按实时 KV 长度动态调度瓦片，混合长度解码比静态 split-KV 平均快，最高 2.95×
- **Router GEMM**：FP32 权重拆两个 BF16 分量，精度接近全精度、吞吐达到 Tensor Core 水平
- **MoE**：融合低延迟流水线压低小型不均衡专家 GEMM 的周边开销
- **端到端**：Hy3-FP8 在 8× H20 上 TPOT 降 15.1%–48.8%、TTFT 降 3.3%–9.0%，H200 上复现普适收益

这套优化最大的价值在于"生产验证过"：它不是实验室里为单一形状调出的基准，而是已经被腾讯混元在线推理跑过的算子，加上通过了逐 token 输出一致性和数值保真度检查。对跑 MoE 长上下文服务的团队，尤其值得在自己负载上实测一轮。

原文：[HPC-Ops × SGLang: Attention, Router GEMM, and MoE kernels from Tencent Hunyuan](https://www.lmsys.org/blog/2026-08-07-hpc-ops-sglang)（LMSYS Blog · Chatbot Arena 团队）
