---
title: "四张 RTX PRO 6000 跑 DeepSeek-V4-Flash：原版 vLLM 零改动部署实测"
description: "原版 vLLM 0.25.1 在 4× RTX PRO 6000 上部署 DeepSeek-V4-Flash：不 fork、不打补丁，256K 上下文、约 133 tok/s、完整工具调用；并如实记录两条官方上限。"
pubDate: 2026-08-11
author: "林晓"
category: "tutorial"
tags: ["DeepSeek", "RTX PRO 6000", "vLLM", "Blackwell", "sm_120", "推理部署", "教程"]
---

DeepSeek-V4-Flash-DSpark（FP8 线性层 + MXFP4 专家，约 157 GB）这种规模的 MoE 检查点，通常被默认成"必须定制内核、打补丁甚至换推理框架才能跑"。但 hermia-ai 发布的一份部署实录给出了相反的证据：用 **4 张 NVIDIA RTX PRO 6000 Blackwell（sm_120，每张 96 GB）**，搭配**原版 vLLM 0.25.1**——不 fork、不打补丁、不用 Docker，两次 `pip install` 加一条 `vllm serve` 就能起服务。实测单流解码约 **133 tok/s**，OpenAI 与 Anthropic 两套工具调用协议全部通过。所有数字都来自 2026 年 7 月 18 日的真实硬件。

仓库把自己定位成"诚实的原版配方"（[hermia-ai/deepseek-v4-flash-sm120-stock-vllm](https://github.com/hermia-ai/deepseek-v4-flash-sm120-stock-vllm)）：它不只给可复现步骤，还明确画出了原版路径的两条天花板——**单请求上下文止步 256K、没有投机解码**——并逐条给出根因、说明什么办法救不了它、以及哪些 fork 能走得更远。

**核心结论**：sm_120 的 DeepSeek-V4 基础支持已经合入上游 vLLM（[PR #43477](https://github.com/vllm-project/vllm/pull/43477)，已合并），因此官方 wheel 装出来就能跑；但原版路径的极限也清晰可见——单请求 prefill 超过 256K 会触发 DeepGEMM 启动失败（错误码 719）并可能把 GPU 拉下 PCIe 总线，投机解码（MTP/DSpark）则因为 sm_120 稀疏解码内核要求 ≥64 token 的批量而无法启用。想突破这两条，只能换 fork。

## 模型与硬件

| 组件 | 配置 |
|---|---|
| 模型 | `deepseek-ai/DeepSeek-V4-Flash-DSpark`，DeepseekV4ForCausalLM，FP8 block-scaled（ue8m0）线性层 + MXFP4 专家（256 路由 / 6 激活），约 157 GB / 48 分片 |
| 架构 | DeepSeek Sparse Attention，`max_position_embeddings` 1,048,576 |
| 硬件 | 4× NVIDIA RTX PRO 6000 Blackwell，96 GB/张，sm_120，PCIe、无 NVLink |
| 推理引擎 | 原版 vLLM 0.25.1 + flashinfer-python 0.6.14，无 fork、无补丁、无 Docker |

sm_120 的模型支持本身是上游工作，这个仓库不包含任何内核代码；它贡献的是"官方 wheel 的落地配方"外加两条原版路径仍然存在的限制。

## 实测结果

| 指标 | 实测值 |
|---|---:|
| 单请求上下文 | 256,000 token（`--max-model-len 262144`） |
| KV 池（@256K） | 2,923,171 token，相当于 11.15× 并发 |
| KV 池（@1M `--max-model-len`） | 6,525,363 token（6.22×）——池子装得下 1M，但单次 prefill >256K 会崩溃 |
| 解码吞吐 | 单流约 133 tok/s（按 `usage.completion_tokens` 计算） |
| Prefill | 256K 下约 12,500 tok/s |
| 长文本检索（needle-in-haystack） | 约 119K 与约 238K 输入 token 均通过 |
| 工具调用 | OpenAI 单次/并行/链式 + Anthropic `tool_use` 全部通过 |
| 权重 / 常驻显存 | 约 38 GB/卡；256K 上下文下常驻约 90 GB/卡 |
| 热启动 | 约 2–4 分钟（sm_120 autotune 缓存可复用） |

完整方法与数字见仓库的 `docs/BENCHMARKS.md`。

## 快速开始

前置条件是一套正常的 NVIDIA 驱动 + CUDA 工具链（`nvcc` 在 PATH 上）和已下载的检查点。然后两步：

```bash
export MODEL=/path/to/DeepSeek-V4-Flash-DSpark   # 检查点目录
export VENV=$HOME/venvs/ds4                       # 独立虚拟环境
export PORT=8000

bash scripts/setup-venv.sh "$VENV"                # 原版 vllm 0.25.1 + flashinfer 0.6.14
MODEL="$MODEL" VENV="$VENV" PORT="$PORT" bash scripts/serve.sh
```

`serve.sh` 的完整内容：

```bash
export FLASHINFER_DISABLE_VERSION_CHECK=1     # flashinfer-python 0.6.14 与 cubin 0.6.13 版本号不一致（PyPI 上没有 0.6.14 的 cubin）
export NCCL_P2P_DISABLE=1                     # 不关闭的话，Blackwell PCIe 上的 P2P allreduce 会死锁
export CUDA_HOME=/usr/local/cuda; export PATH="$CUDA_HOME/bin:$PATH"   # MHC-prenorm TileLang JIT 需要 nvcc

"$VENV/bin/vllm" serve "$MODEL" \
  --served-model-name deepseek-v4-flash \
  --host 127.0.0.1 --port 8000 \
  --tensor-parallel-size 4 --enable-expert-parallel \
  --kv-cache-dtype fp8 \
  --max-model-len 262144 \
  --gpu-memory-utilization 0.90 \
  --kernel-config '{"moe_backend":"marlin"}' \
  --enable-auto-tool-choice --tool-call-parser deepseek_v4 --reasoning-parser deepseek_v4 \
  --trust-remote-code
```

健康启动的标志是日志里自动选中一组 sm_120 后端，不需要额外参数：`scale_fmt=ue8m0` 启用 DeepGEMM 的 UE8M0、MHC-prenorm TileLang 内核完成 JIT 编译、MoE 使用 `MARLIN` MXFP4 后端、FlashInfer 自动调优 SM120 稀疏 MLA DSv4 解码。启动后可以直接验证：

```bash
BASE=http://127.0.0.1:8000 python3 bench/toolcalls.py          # 工具调用：OpenAI + Anthropic
BASE=http://127.0.0.1:8000 python3 bench/needle.py 128000 0.5  # 长上下文检索
```

## 两条天花板：先读再调 `--max-model-len`

KV 池轻松装得下一百万 token，所以"顺手把 `--max-model-len` 设成 1048576"看起来天经地义。**但原版路径上不要这么做**——单个请求的 prefill 进入 256K 以上范围会以 DeepGEMM 启动失败（错误码 719）崩溃，甚至把一张 GPU 从 PCIe 总线上拉下来。仓库的 `docs/BUGS.md` 给出了完整证据链，短版本如下：

1. **不是 prefill 分块大小的问题。** 把 `max_num_batched_tokens` 从 8192 调到 512，崩溃现象完全一样——故障随总序列长度缩放，而不是分块策略。
2. **`VLLM_USE_DEEP_GEMM=0` 连启动都过不去。** 关掉 DeepGEMM 后，E8M0 FP8 线性层会落到 CUTLASS，而它在 sm_120 上直接断言失败（`dispatch_scaled_mm ... scaled_mm_helper.hpp:17`）。这条 flag 在这里是死路：这些 FP8 线性层在 sm_120 上根本没有非 DeepGEMM 的内核可用。
3. **DeepGEMM 上游没有 sm_120 的计划**，所以不存在原版修复；想要 1M 单请求上下文，只能换 fork（见下文）。

第二条限制是投机解码。MTP 或 DSpark 在原版路径上会在初始化时就挂掉：sm_120 的稀疏解码内核要求 ≥64 token 的批量，而投机验证提交的批量是 1–7（报错如 `Check failed: num_tokens > 64 ... sparse_mla_sm120_decode_dsv4; got num_tokens=1`）。所以原版只能跑 base 模型。vLLM 的 [PR #41834](https://github.com/vllm-project/vllm/pull/41834)（打开中）就是来补这条路的。

> 还有一个常见的启动报错值得记下来：`NotImplementedError: DeepGEMM MegaMoE requires SM100 GPUs` 不是硬件不行的意思，而是需要显式指定 `--kernel-config '{"moe_backend":"marlin"}'` 让 MoE 走 MARLIN 后端。

## 补充调研：vLLM 0.26/0.27 支持 sm_120 上的 DSpark 了吗？

截至 2026 年 8 月 11 日，**答案是否定的**：vLLM 0.26.0 与 0.27.0 的正式版本都没有把 NVIDIA sm_120 上的 DSpark 列为受支持能力。[v0.26.0 发布说明](https://github.com/vllm-project/vllm/releases/tag/v0.26.0)里 DSpark 投机解码只写了 AMD（#47419）和 XPU（#47677）两条；[v0.27.0](https://github.com/vllm-project/vllm/releases/tag/v0.27.0)（2026-08-10 发布）同样没有任何 NVIDIA sm_120 DSpark 的条目。真正把 SM120/121 + DSpark 作为完整路径提供的 [PR #41834](https://github.com/vllm-project/vllm/pull/41834)（jasl）至今仍未合并（8 月 10 日还有更新，验证头 8 月 9 日同步到 `upstream/main`）——想现在就在 RTX PRO 6000 上跑 DSpark，仍然只能走它的分支或社区 fork。

更值得注意的是：即使拿 0.26.0/0.26.1rc1/当前 main 硬开 DSpark，也会在启动或预热阶段崩溃，这条路径在 [issue #50720](https://github.com/vllm-project/vllm/issues/50720)（open）里被反复复现。讨论把根因定位到了 FlashInfer 而非 vLLM：

- FlashInfer 的 SM120 稀疏 MLA DSV4 **解码**内核只为 `topk ∈ {128, 512, 1024}` 实例化；DSpark 草稿的 `dspark_markov_rank=256` 作为主索引命中不了分发表，于是掉进一个拒绝小批量（`num_tokens > 64`）的 prefill 编排器，报错形如 `Check failed: num_tokens > 64 ... got num_tokens=5/7`。
- 报错里的 5/7 是 `num_speculative_tokens`，是个误导项——任何 `topk=256` 的小批量形状都会踩中，RTX PRO 6000（SM120）与 DGX Spark/GB10（SM121）、开不开 expert parallel 都能复现。
- FlashInfer 侧的修复 [PR #4380](https://github.com/flashinfer-ai/flashinfer/pull/4380)（补 top-k 192/256）已于 2026-08-08 合并，第一个包含它的发布是 **v0.6.16.post4**（2026-08-10）；但 vLLM v0.27.0 仍把 FlashInfer 钉在 0.6.16.post3（#50892），所以官方发布版至今没有内置这个修复——想绕开崩溃，只能像本仓库做的那样手工升级 flashinfer wheel。
- 崩溃之外还有一串未合入的 vLLM 侧修复：PR #51538（让 DSV4 稀疏 MLA 在 plain decode / MTP / DSpark 三种模式下端到端可用，8× RTX PRO 6000 验证）、PR #48304（MTP 层 `compress_ratio`，DSpark 正确运行必需）、issue #51009（0.26.1rc1 上 DSpark 接受率在 position 0 之后塌陷）、issue #51593（MTP 批量排空后挂起）。vLLM 侧曾有一个绕过补丁 #51254（把 DSpark SWA 索引宽度取整到可分发的 topk），已关闭未合并，被 FlashInfer 的修复取代。

所以"原版路径没有投机解码"这条结论在 0.26/0.27 上依然成立，只是机制从"内核要求 ≥64 token 批量"细化成了"FlashInfer SM120 分发表缺 topk=256"。官方完整支持的预计节奏是等 0.27.x 补丁或 0.28 把 FlashInfer 0.6.16.post4+ 与上述修复一起带上；在那之前，sm_120 上的 DSpark 用户只能选择 fork 或手工补丁。

## 工具调用与 Claude Code

`--tool-call-parser deepseek_v4 --reasoning-parser deepseek_v4` 下两套 API 都能用：

- OpenAI `tool_calls`：单次、并行、链式（工具结果 → 最终回答）全部通过；
- Anthropic `/v1/messages`：返回正确的 `stop_reason=tool_use` 与 `tool_use` 块。

需要注意两点。其一，DeepSeek-V4 会先输出一段 reasoning 再给答案，所以客户端必须给足 `max_tokens`（≥1024），预算太小会得到**静默的空回答**。其二，如果你把 Claude Code 指向这个服务，新版本 Claude Code 会在 `messages[]` 里塞一条 `role:"system"` 消息、还会传一个 vLLM 不接受的 `output_config.effort` 值——两者都会让会话挂起而不是报错。解决办法是老套路：在 vLLM 前面加一个小的请求归一化反向代理，把非 user/assistant 消息挪到顶层 `system` 字段，并把 effort 值钳制住。

## 这个仓库不是什么

- **不是 fork**：原版 `pip install vllm==0.25.1` + 一个 flashinfer 版本升级，没有任何东西被 patch。
- **不是基础支持本身**：sm_120 的 DeepSeek-V4 支持来自上游 vLLM（#43477 已合并，PR #41834 打开中）。这个仓库提供的是"官方 wheel 配方 + 诚实的限制说明"，而不是内核。
- **不是新量化方案，也不是模型发布**：检查点是 DeepSeek 的，仓库不托管任何权重。
- **不是最高上下文或最快路径**：它按设计停在 256K、没有投机解码——下面的 fork 地图才是往更远走的方向。

## 想走更远：fork 地图

| 维度 | 本仓库 | fork 路径 |
|---|---|---|
| 安装 | `pip install vllm==0.25.1` + flashinfer 升级 | 源码构建 / Docker |
| 单请求上下文 | 256K | 最高 1M |
| 投机解码 | 无（原版内核缺口） | MTP / DSpark / EAGLE |
| 框架 | 原版 vLLM | vLLM PR #41834 分支 · B12X fork · SGLang |

仓库的 `docs/PRIOR-ART.md` 整理了完整的 fork 地图，包括 jasl 的 vLLM PR #41834（sm12x "stock-deps" 路径，补 MTP2 + DSpark 投机解码）、[0xSero/deepseek-v4-flash-sm120](https://github.com/0xSero/deepseek-v4-flash-sm120)、[hikarioyama/dsv4-flash-nvfp4-sm120](https://github.com/hikarioyama/dsv4-flash-nvfp4-sm120) 和 [sakamakismile/DSv4-Flash-FP8-SM120-Configs](https://github.com/sakamakismile/DSv4-Flash-FP8-SM120-Configs) 等社区方案。

## 致谢与许可

仓库致谢了 vLLM #43477（合入的 sm_120 DeepSeek-V4 基础支持）、jasl 的 PR #41834（在途的投机解码修复）、vLLM #40802（SM120 DeepSeek-V4 跟踪 issue）以及上述社区 fork。仓库与文档均为 Apache-2.0。

原文：[DeepSeek-V4-Flash-DSpark on 4× RTX PRO 6000 — stock vLLM 0.25.1, no fork, no patch](https://github.com/hermia-ai/deepseek-v4-flash-sm120-stock-vllm)（hermia-ai，2026-07-18 实测）。
