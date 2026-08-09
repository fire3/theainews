---
title: "vLLM Decode Context Parallelism：把长上下文 KV 缓存“切开”分摊到每张卡"
description: "vLLM 详解 Decode Context Parallelism：沿序列维度切分 KV 缓存而非按注意力头复制。单 8×B200 测 Kimi K2.6，显存占用 82% 时吞吐仍达 6091 tok/s/GPU，是张量并行的 3 倍以上。"
pubDate: 2026-08-08
author: "林晓"
category: "research"
tags: ["vLLM", "长上下文", "KV Cache", "并行", "推理优化", "MLA"]
image: "/covers/vllm-decode-context-parallelism.jpg"
imageAlt: "沿序列维度切分 KV 缓存分摊到多张 GPU 的抽象插画"
---

8 月 7 日，vLLM 团队发文详解了它已经支持近一年的 **Decode Context Parallelism（DCP，解码上下文并行）**，并附上了针对长上下文智能体工作负载的最新基准。之所以现在专门写一篇，是因为长上下文智能体用例的爆发，让它比以往任何时候都更有意义——从论文问答、整个代码仓库推理，到多轮智能体流水线，动辄 64K 甚至 1M token 的输入，把 KV 缓存撑到了必须重新思考"显存往哪放"的地步。

一句话概括 DCP：**把 KV 缓存的副本摊开，改成切分**。基线张量并行（TP）按注意力头切分 KV，硬性地界定了它能缩小到什么程度；DCP 则按**序列（上下文）维度**切分，让每张卡只存和只读整个 KV 缓存的一部分。显存省下来，就能塞进更多并发请求、跑更大的 batch，从而在不牺牲交互延迟的前提下服务更多长上下文智能体。

## 为什么长上下文先撞上显存墙

问题出在现代模型两种注意力机制上，而且两种都会撞到同一堵墙。

**GQA（分组查询注意力）**：只存少量 KV 头。TP 按头切分 KV，最多切到"每张卡一个头"——一旦 TP 的卡数超过 KV 头数量，多出来的卡就只能复制同一份头，KV 缓存开始在不同卡之间重复。

**MLA（多头潜变量注意力）**：更糟。MLA 把 Key/Value 压缩成一个跨所有查询头共享的低秩潜变量向量，相当于**只有一个 KV 头**。在普通 TP 下根本没有"头"可分，于是这个潜变量 KV 缓存会在每个 TP rank 上完整复制一份。

无论哪种，被重复的 KV 缓存都在白白吃显存，导致能同时服务的请求数大减、吞吐下降、每 token 成本上升。DCP 正是冲着这个来的：把 KV 缓存切开，每张卡只承担一部分，把省下的显存换成更大的 batch 和更高的并发。在高带宽的卡间互连上，这能在服务大量长上下文 Agent 时保住交互式响应速度。

## 实测收益：同样的卡，吞吐差出一个量级

为了让数字有说服力，团队用**完全相同的模型、硬件和工作负载**做了对照，只改变一件事——解码时 KV 缓存怎么切分。

**数据集**是公开的 Mooncake 格式智能体长上下文轨迹（JSONL，每条含 `input_length`、`output_length`、`hash_ids` 字段，可直接用 `aiperf --custom-dataset-type mooncake_trace` 复现）。它模拟真实长时智能体行为：输入中位数约 **67k token**、输出约 400 token，是"长输入配短生成"的多轮负载。输入是双峰的而非全都巨大——约 53% 在 64k+（尾部可达 1M token），约 47% 在 64k 以下（约 18% 低于 8k），约 8% 超过 128k、3–4% 超过 256k。

**硬件**是单个 8×B200 节点，跑 Kimi K2.6（NVFP4 量化），把请求并发从 16 扫到 512。结果是全面的优势：

| 配置 | KV 显存 | 峰值吞吐 |
|---|---|---|
| 基线 TP | 并发 64 即达 100% | 约 1,863 tok/s/GPU（触顶封死） |
| DCP | 并发 512 时仍仅 82% | 6,091 tok/s/GPU（持续爬升） |

差别就在 KV 缓存放哪：基线 TP 把 KV 复制到每张卡，峰值显存很快填满，并发到 64 就撞墙、吞吐封死；DCP 沿序列维度切分后，每张卡只存每条请求 KV 的 1/N，即使在高并发下也一直有余量扩容。

团队还按全长（输入+输出）把请求分成了 `<32k、32–64k、64–128k、128–200k、200k+` 五个区间。在 **200k+ 区间 DCP 依然保持一条高而稳定的吞吐–交互 Pareto 前沿**，长短区间的曲线几乎重叠——吞吐随并发增长，而用户侧速度在复制 KV 的基线早已显存耗尽、无法扩容的长上下文区间依然可用。

## DCP 到底怎么工作

纯 TP 无法把单条 KV 缓存再切成更小的块：KV 头是能交给一张卡的最小单元，一个标准 TP 没有机制去切单个头的 KV。所以当 TP 规模超过 KV 头数 `K`，就会出现两张卡持有同一份头的情况。

DCP 则把 KV 按序列（上下文）维度切分到各卡。以一条 200K token 的请求为例，GPU 0 可能持有 0–50K、GPU 1 持有 50K–100K、GPU 2 持有 100K–150K、GPU 3 持有 150K–200K。切分后，**每张卡的 KV 占用随卡数增加持续下降**，从而释放显存、提高 batch、撑起更高并发。

标准的 DCP 把通信模式保持得很简单，遵循 `AllGather Q → Compute → AllGather + ReduceScatter` 三步：

1. **AllGather Q**：每张卡只算出了一小段 query，但注意力需要完整的 query 向量去和任意 key 打分，因此要在 DCP 组内 all-gather 出一份完整 query。解码时 query 只是一个 token，成本很低。作为可选优化（vLLM #45964），MLA 可以在加载时复制这份很小的 query 投影，让解码彻底跳过这次 all-gather（`VLLM_DCP_Q_REPLICATE=1`）。
2. **Compute**：每张卡用 gathered 的 query 和自己的 KV 切片做注意力。在 vLLM 里，MLA 对应 `k_up`，GQA 对应 `tensor_broadcast`。
3. **AllGather + ReduceScatter**（`cp_lse_ag_out_rs`）：把各卡的部分结果合并成真正的输出。AllGather 共享每张卡的部分输出和 LSE，用 LSE 做加权合并（online-softmax 技巧），再由 ReduceScatter 求和，同时把每张卡自己那一份头切片还回去。

另外一个常被忽略的点：DCP 并不是让 GPU 闲置地等注意力。算完序列切分后，这些卡立刻重组，去**摊销整个池子的 FFN 权重加载**。所以 DCP 是"让每张卡都真正干活"，而不是"切分了就空着"。

## 怎么用：一个参数的事

DCP 在 vLLM 里只多一个参数 `decode_context_parallel_size`，和已有的张量并行设置搭配即可。

**离线（Python）**：

```python
from vllm import LLM, SamplingParams

prompts = ["The future of AI is"]
sampling_params = SamplingParams(temperature=0.8, top_p=0.95)

llm = LLM(
    model="deepseek-ai/DeepSeek-V2-Lite",
    tensor_parallel_size=2,
    decode_context_parallel_size=2,
)
outputs = llm.generate(prompts, sampling_params)
```

**在线（CLI）**：

```bash
vllm serve deepseek-ai/DeepSeek-V2-Lite \
  --tensor-parallel-size 2 \
  --decode-context-parallel-size 2
```

### MLA 后端

适用于 DeepSeek-V2/V3/R1、Kimi K2.6 等使用 MLA 的模型。MLA 把 K/V 压缩成跨所有查询头共享的单个低秩向量，纯 TP 下没有"头"可分，整个潜变量 KV 缓存被完整复制在每张卡上。**正因为整份缓存都是冗余的，它才能被完全序列切分**——换句话说，MLA 是 DCP 最理想的候选：DCP 沿序列维度切分潜变量 KV，注意力时每张卡先用 `k_up` 上投影出自己的潜变量切片，重建所需的 K/V。由于有效 KV 头数为 1，序列最多可切分到完整的 TP 规模，约束是：

```text
tensor_parallel_size >= decode_context_parallel_size
tensor_parallel_size % decode_context_parallel_size == 0
```

```bash
vllm serve deepseek-ai/DeepSeek-R1 \
  --tensor-parallel-size 8 \
  --decode-context-parallel-size 8
```

### GQA 后端

适用于 Qwen3-235B 及 Llama 家族等 GQA 模型。GQA 存 `num_key_value_heads` 个 KV 头，TP 先按头切分——这在头数量范围类没问题，但一旦 TP 超过头数，就会出现 `tp // num_key_value_heads` 份重复副本。DCP 的做法是**把这些本该重复的副本换成不同的序列块**，共享的 KV 头则广播到各自的查询头上（GQA 的 `tensor_broadcast` 步）。因此序列切分的上限由冗余因子决定：

```text
(tensor_parallel_size // num_key_value_heads) >= decode_context_parallel_size
(tensor_parallel_size // num_key_value_heads) % decode_context_parallel_size == 0
```

```bash
# Qwen3-235B 的 num_key_value_heads=4，tp=8 时 8//4=2 份冗余副本，
# 所以 dcp 最大可取 2
vllm serve Qwen/Qwen3-235B-A22B \
  --tensor-parallel-size 8 \
  --decode-context-parallel-size 2
```

## 未来的路线

作者列出了后续几个主要方向：

- **更细粒度的并行规模**：为 TP 和 DCP 都支持更细的切分，让用户更精确地控制并行布局，回收过度配置带来的效率损失
- **更好的 A2A 通信内核**：为多节点和单节点分别开发更优的 all-to-all 内核，随上下文长度和设备数增长，减少暴露的通信量、增强与计算的重叠
- **更好支持 MTP 与投机解码**：让 DCP 在拿到效率收益的同时，不掉投机解码的延迟优势
- **加固 prefill/decode（P/D）分离**：让 DCP 在分离式服务部署里也足够稳健
- **扩大覆盖面**：支持更多后端，并集成混合模型与 Dynamic Chunked Pipeline Parallelism，让更广的工作负载受益

社区也在把 DCP 扩展到 GLM-5.2、Kimi K3 等更多模型，并有一条更长期的 **Prefill Context Parallelism（PCP）**路线图。团队正在为 Kimi K3 做 DCP 性能基准，成熟后会公布结果。

## 核心总结

- **问题**：GQA 和 MLA 在 TP 下都会复制 KV 缓存，长上下文请求一多，显存先被吃光，并发和吞吐撞墙
- **方案**：DCP 沿序列维度切分 KV 缓存，每张卡只存 1/N，省下的显存换成更大的 batch 和更高并发
- **收益**：同样的 8×B200，基线 TP 并发 64 即满、吞吐 1,863 tok/s/GPU 封死；DCP 在并发 512、显存仅 82% 时达 6,091 tok/s/GPU
- **上手**：`--decode-context-parallel-size` 一个参数即可，MLA 可切满整个 TP 度，GQA 按冗余因子 `tp // num_key_value_heads` 上限切分
- **方向**：更细粒度并行、A2A 内核、MTP/投机解码、P/D 分离强化，社区在扩到 GLM-5.2、Kimi K3，并有 PCP 路线图

DCP 在 vLLM 里已经原生支持近一年，这次的博客把它从"一项技术特性"重新摆到了台面上：当长上下文 Agent 推理成为主流，按头复制 KV 的旧模式注定要退位，取而代之的是把序列切开、让每张卡都真正出力的新组织方式。上游早已接好，剩下的就是用起来。

原文：[Efficient Decode Context Parallelism with vLLM for Long Context Workloads](https://vllm.ai/blog/2026-08-07-decode-context-parallelism)（vLLM）
