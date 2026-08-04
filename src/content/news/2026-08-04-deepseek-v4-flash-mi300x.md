---
title: "DeepSeek V4 Flash 单卡部署教程：一块 AMD MI300X 跑通 304B 模型"
description: "开源生产栈在单块 MI300X 部署 DeepSeek-V4-Flash：FNUZ FP8 修复、DSpark-7 投机解码，单流 168.6 tok/s。"
pubDate: 2026-08-04
author: "林晓"
category: "tutorial"
tags: ["DeepSeek", "MI300X", "vLLM", "ROCm", "推理部署", "教程"]
---

DeepSeek-V4-Flash-0731 是一个 304B 参数的 MoE 检查点，官方 vLLM 部署方案只覆盖 NVIDIA 和更新的 AMD 显卡（MI325X、MI355X），单独一块 MI300X 并不在支持清单里。要在 `gfx942` 上把它跑稳，需要处理 FP8 格式不兼容、高并发下 MoE 路由错误、投机验证的因果掩码、CPU-KV 同步以及一堆未调优的内核形状。2026 年 8 月 4 日，Ryan Zhou 开源了一套经生产验证的单卡部署栈，把这些问题全部收拢进一个 digest 锁定的 Docker Compose 项目里，附带 SHA-256 校验、可追溯的补丁与 AITER 调优表。

**核心结论**：在这套固定版本栈（vLLM ROCm nightly `0.26.1rc1.dev229+g124154a88.rocm723`、AITER `0.1.19`）上，模型权重 156.67 GiB 全部装入 HBM、无需额外量化或权重卸载；DSpark-7 投机解码下单流解码中位数 **168.6 tok/s**，8 路并发 542 tok/s 聚合、单流中位数 90.3 tok/s，64 路突发 830 tok/s 无 OOM；256K 上下文实测通过（架构本身支持 1M）。

## 为什么选择 MI300X

MI300X 拥有 **192 GB HBM3** 和 5.3 TB/s 内存带宽，HBM 容量是 H100 SXM5 的 2.4 倍；按 Doubleword 的估算，清单价大约只有后者的一半。对 304B 检查点来说，这份容量让"单卡部署"成为可能：

- 整个模型装入 HBM，无需 PCIe 权重流式传输或层卸载；
- 还能腾出 20 GB 的 GPU KV 池与 96 GiB 的 CPU 驱逐层（缓存前缀条目）；
- 单卡可以服务 2–8 路典型并发流，突发最高 64 路。

不过 MI300X（CDNA3）实现的是 AMD/Graphcore 的 `fnuz` 变体 E4M3，而 MI325X 及更新型号使用 OCP 标准 FP8。在内核假设 OCP 语义的 MI300X 上，缩放域可能错到两倍——正确性修复是整个部署的第一优先级，性能调优排在之后。

## 前人工作，以及这个仓库补了什么

Fergus Finn 的 MI300X 工作日志与配套的 doublewordai/vllm-amd-blog-doubleword 仓库已经定位了 FP8 不兼容、`gfx942` 上缺失的 AITER 快速路径、稀疏 MLA 解码中的 HIP-graph 隐患和 MoE 路由错误。官方 vLLM recipe 覆盖 NVIDIA 与更新的 AMD GPU（MI325X 仅 4K 上下文、MI355X），但并没有 0731 检查点在单 MI300X 上的生产配置。这个仓库在两者之上补了四件事：

1. **正确性 overlay**：针对锁定的 ROCm nightly，包含尚未合入上游 vLLM 的修复；
2. **经过验证的服务配置**：概率式 DSpark 草稿 + 块拒绝 + 静态 K=7，用 2,048 token 调度预算和 1,024 token 长 prefill 上限，防止冷 prompt 卡住其他流；
3. **AITER GEMM 调优表**：补齐 `gfx942` 上重复出现的形状，外加 MXFP4 专家的 `gfx942` OGS 几何覆盖；
4. **混合 KV 策略**：20 GB `fp8_ds_mla` GPU 缓存 + 96 GiB 原生 CPU 卸载，并带上加载路径的 fencing 修复（上游 [issue #47282](https://github.com/vllm-project/vllm/issues/47282) 有文档、[PR #47291](https://github.com/vllm-project/vllm/pull/47291) 从未合入）。

仓库布局：

```text
.
├── compose.yaml         # 生产栈（vLLM ROCm + Caddy），digest 锁定
├── Caddyfile.example    # 复制为 Caddyfile，设置域名、邮箱与来源 CIDR
├── vllm-entrypoint.sh   # 启动前清理 /dev/shm 中的陈旧 CPU-KV mmap
├── SHA256SUMS           # 所有运行时产物的 SHA-256 固定
├── patches/             # 逐字节生产 overlay + 与上游基准的参考 diff
└── tuning/              # gfx942 的 AITER A8W8 blockscale 调优表
```

## 基准结果

| 指标 | 结果 |
|---|---:|
| 单流解码（DSpark-7，每流中位数） | **168.6 tok/s** |
| 调优内核下的 prefill | ≈ 7.9–8.5K tok/s（出厂配置下全新 prompt 6,988–7,019 tok/s） |
| 8 路并发 | 542 tok/s 聚合，单流中位数 90.3 tok/s |
| 64 路突发 | 830 tok/s 聚合，无 OOM、无引擎错误 |
| 上下文 | 256K 验证通过（架构支持 1M） |
| HBM 中的权重 | 156.67 GiB，无额外量化或权重卸载 |

> DSpark 接受率与 prompt 相关，以上数字应视为这套精确镜像的门槛值，而非通用模型基准。

## 部署步骤

### 1. 主机前置条件

- 一块 MI300X（`gfx942`，304 个 CU，约 192 GiB HBM），可用的 AMD 内核驱动，较新的 Docker Compose；
- 约 235 GiB 内存供 CPU KV 层使用；
- 约 500 GB 磁盘（仅模型缓存就约 156 GB）。

### 2. 拉取锁定的运行时与模型

```bash
VLLM_IMAGE='vllm/vllm-openai-rocm@sha256:e68d18b2ba50298661bfc49baf01158fbf036645c2362cccf3e8a7a79fe6c69a'
MODEL='deepseek-ai/DeepSeek-V4-Flash-0731'
REVISION='7872f01b1d1fe23eabc4c98b48bffcef5a386062'

docker pull "$VLLM_IMAGE"
docker run --rm --entrypoint hf \
  -v /root/.cache/huggingface:/root/.cache/huggingface \
  "$VLLM_IMAGE" download "$MODEL" --revision "$REVISION"
```

### 3. 准备文件

```bash
cp Caddyfile.example Caddyfile   # 然后设置你的域名、邮箱与 remote_ip CIDR
mkdir -p aiter-cache crash-dumps
chmod +x vllm-entrypoint.sh
sha256sum -c SHA256SUMS        # 首次启动前校验 overlay
```

### 4. 启动

```bash
docker compose config -q
docker compose up -d
docker compose logs -f inference
```

健康启动约需 5 分钟，日志必须依次出现以下全部内容：

```text
Model loading took 156.67 GiB
DSpark draft model loaded: 96 params
GPU KV cache size: 1,927,444 tokens
Maximum concurrency for 262,144 tokens per request: 7.35x
Created mmap file /dev/shm/vllm_offload_...mmap (103.08 GB)
Capturing CUDA graphs (FULL)
Application startup complete
```

图捕获完成后运行 `rocm-smi --showmeminfo vram`，预热高位水位约为 205.8 GB 中的 204.5 GB。如果只剩几百 MB，服务可能能启动、但第一个请求就会失败。

### 5. 冒烟测试

```bash
HOST='your-host.example.com'
curl -fsS "https://$HOST/v1/models"
curl -sS "https://$HOST/v1/completions" \
  -H 'Content-Type: application/json' \
  -d "{\"model\": \"deepseek-ai/DeepSeek-V4-Flash-0731\",
       \"prompt\": \"Calculate 17 * 23. Answer with the number only.\",
       \"temperature\": 0, \"max_tokens\": 32}"
```

## 关键配置解读

`compose.yaml` 由 `inference` 与 `caddy` 两个服务组成：前者是 digest 锁定的 vLLM ROCm nightly，后者是只允许来源 IP 访问的 HTTPS 反代。推理服务的核心参数如下：

| 配置项 | 值 | 说明 |
|---|---|---|
| 镜像 | `vllm/vllm-openai-rocm@sha256:e68d…c69a` | digest 锁定的 nightly，构建版本 `0.26.1rc1.dev229+g124154a88.rocm723` |
| `--kv-cache-dtype` | `fp8`（`fp8_ds_mla`） | UE8M0 block-scaled FP8，不是通用无缩放 FP8 |
| `--block-size` | `256` | 256 token 块 |
| `--max-model-len` | `262144` | 256K 上下文（架构支持 1M） |
| `--kv-cache-memory-bytes` | `20000000000` | 约 20 GB 的 GPU KV 池 |
| `--kv-offloading-size` / `--kv-offloading-backend` | `96` / `native` | CPU KV 层，在 `/dev/shm` 映射约 103 GB |
| `--max-num-seqs` | `64` | 最大并发序列 |
| `--max-num-batched-tokens` | `2048` | 调度预算；DSpark-7 预留草稿槽位后实际可用 1,664 |
| `--long-prefill-token-threshold` | `1024` | 长 prefill 上限，防止冷 prompt 阻塞其他流 |
| `--moe-backend` | `triton` | Triton OGS 处理分组 MXFP4 专家；AITER 负责 attention 与 dense 线性层 |
| `--speculative-config.*` | `dspark` / 7 / `probabilistic` / `block` | DSpark-7 概率草稿 + 块拒绝 |
| `VLLM_ROCM_USE_AITER` | `1` | 启用 ROCm AITER 调优内核库 |

环境方面还设置了 `VLLM_ROCM_USE_SKINNY_GEMM=0`、AITER 的 A8W8 blockscale 预洗牌调优表路径，以及 GPU 核心转储目录。`--trust-remote-code` 配合 DeepSeek V4 的 tokenizer、reasoning 与工具解析器（`--tokenizer-mode deepseek_v4`、`--reasoning-parser deepseek_v4`、`--tool-call-parser deepseek_v4 --enable-auto-tool-choice`），并开启 `--enable-prompt-tokens-details`。

Caddy 只放行白名单网段对 `/v1/chat/completions`、`/v1/completions`、`/v1/models`、`/health`、`/metrics`、`/generate` 的访问，其余一律 403，并把流式响应设置为 `flush_interval -1` 以保持逐 token 输出。

## 补丁体系

`patches/*.py` 是**逐字节覆盖**的生产 overlay，以只读方式挂载进容器（挂载路径写在 `compose.yaml` 里）；`patches/diffs/*.patch` 是相对上游基准的统一 diff，用于审计。基础镜像 digest 固定，升级等于换镜像引用并重新验证整栈。

| Overlay | 覆盖文件 | 修复内容 |
|---|---|---|
| `gpt_oss_triton_kernels_moe.pack128-fused-silu-fast-routing.py` | fused MoE 专家内核 | MXFP4 bitmatrix 填充 lane + fused-SiLU 分组专家 + 快速 DeepSeek 路由，**MXFP4 Triton 路径必装** |
| `mxfp4.fused-silu.py` | fused MoE oracle | Gate/up 交错布局，配合 fused-SiLU overlay 使用 |
| `triton-kernels-matmul-ogs-opt-flags.dsv4-mi300x.py` | Triton OGS 几何 | `gfx942` MXFP4 OGS 瓦片几何（最高 1,536 路由行），纯性能项 |
| `fused_compress_quant_cache.fnuz-shuffle.py` | Lightning Indexer 缓存写入 | **FNUZ FP8 + 16×16 预洗牌**，MI300X 必装；MI325X/MI355X 用 OCP FP8 必须保留原版 |
| `aiter_pa_mqa_logits.i64.py` | AITER paged-MQA 内核 | 64 位偏移，KV 偏移可能超过 4 GiB 时需要 |
| `rocm_aiter_mla_sparse.prefill-bh64.py` | 稀疏 prefill | 确定性 `torch.topk` + `BLOCK_H=64` head-512 稀疏 prefill |
| `rocm_aiter_mla.dspark-causal.py` | MLA 后端 | ROCm 小头 MLA 的因果多 token 投机验证，现已在 vLLM 上游 |
| `dspark-speculator.independent-draft-gumbel.py` + `spec-decode-utils.independent-draft-gumbel.py` | 投机解码 | 草稿采样的 Gumbel 噪声与拒绝/恢复噪声分离 |
| `kv_offload_cpu_gpu_worker.load-war.py` | CPU-KV 加载 | 为 CPU→GPU 的 KV 恢复路径加栅栏，使其排在在途计算之后（#47282 / PR #47291） |

### 两个关键的正确性修复

**MXFP4 路由。** MoE bitmatrix 内核把块列填充到 Triton 块大小，但填充 lane 原来按全局张量边界而不是逻辑块大小做掩码。负载下填充 lane 会污染路由矩阵，导致长 prompt 上出现近似的工具名匹配和 schema 遗忘。一行修复来自 Doubleword 的提交 `c32932bb9`：`mask = (offs_local < BLOCK_SIZE) & (offs_global < nonzero_indx_size)`。

**FP8 格式。** DeepSeek V4 的 Lightning Indexer 缓存使用 FP8，原版写入器按行主序输出 OCP E4M3 字节，而 MI300X 上的 AITER 消费的是 AMD FNUZ E4M3 字节、且采用 16×16 预洗牌瓦片布局。最坏情况下，把一种格式当另一种解析会产生两倍的缩放误差。overlay 在 ROCm 上选择 `float8e4b8`（`FP8_MAX=224.0`）和洗牌后的写入偏移，其他平台保持 OCP 路径不变。

## 性能调优点

| 改动 | 效果 |
|---|---|
| 为 304-CU `gfx942` 调优 21 个高频 A8W8 GEMM 形状 | 单/双流解码 +42–62%，8–64 流 +10–35% |
| fused-SiLU、快速 DeepSeek 路由、批感知专家瓦片 | 原生 C1 解码 34.5 → 56.6 tok/s（+64%）；路由内核 42.6 → 11.9 µs/层 |
| `BLOCK_H=64` 稀疏 prefill 瓦片 | prefill 达 7.9–8.5K tok/s；稀疏注意力 trace 317 → 142 ms/请求 |
| 静态 K=7 + 概率草稿 + 块拒绝 + 因果验证 | 单流 119.5 tok/s 且输出正确 |
| 2,048 token 预算 + 1,024 token 长 prefill 上限 | 52K prefill 之后排队短请求的 TTFT：8.2 s → 0.5 s |
| 20 GB GPU KV + 96 GiB CPU 层 | 约 1.93M token 的等效容量，可接纳 7 个 256K 请求 |

### 最终并发扫描

约 400 词的独立 prompt、流式输出、`temperature=1.0, top_p=0.95`；C1–C8 输出 512 token，C64 输出 256 token：

| 流数 | 聚合 tok/s | 单流解码中位数 | TTFT p50 |
|---:|---:|---:|---:|
| 1 | 126.2 | **168.6** | 1.026 s |
| 2 | 145.4 | 152.7 | 0.939 s |
| 4 | 316.8 | 108.6 | 0.369 s |
| 8 | 542.3 | 90.3 | 1.027 s |
| 64 | 830.2 | 16.4 | 2.190 s |

## 生产注意事项

- **HBM 余量很小。** 预热高位水位为 205.8 GB 中的 204.5 GB。30 GB 的 KV 池能加载、但会在图捕获时以 `HSA_STATUS_ERROR_OUT_OF_RESOURCES` 失败。不要调高 `--kv-cache-memory-bytes`，并持续监控 HBM 用量增长。
- **CPU KV 层存的是缓存条目，不是权重。** `--kv-offloading-size 96 --kv-offloading-backend native` 会在 `/dev/shm` 映射约 103 GB 供驱逐的前缀缓存条目使用；entrypoint 会在崩溃后清理陈旧映射。强制 `SIGKILL` 无法执行清理，可能留下孤儿 mmap 文件。
- **1,664 token 的调度器警告是预期的。** DSpark-7 会从 2,048 token 预算里预留草稿槽位。调高预算会保留更多在途滑动窗口状态、减少可用 KV 容量。
- **重启后先热内核。** 首次 prefill 会初始化内核，8.9K token 需要 5.3 s，后续运行仅 1.7 s。接入流量前先跑一次无缓存 prefill。
- **正确性要和吞吐一起测。** 验证套件包括两轮工具调用 fixture、BFCL 子集（74–76/90 精确调用）、OpenCode 工具 schema 检查，以及 380K token 的 needle recall（native 与 DSpark 两条路径都测）。冷与缓存 prefill 可能走不同的浮点路径，两条都要测。

## 许可证与溯源

仓库、文档与 vLLM 衍生的 overlay 均为 Apache-2.0（见 `LICENSE`）；AITER 衍生 overlay 保留其 MIT 头。模型本身是 MIT 许可。每个 diff 的上游基准修订都记录在 `patches/README.md`，生产镜像则是 vLLM ROCm nightly，可能与任何单一上游修订略有差异——overlay 是事实来源，diff 只是文档。

原文：[DeepSeek V4 Flash on a single AMD MI300X](https://github.com/ryanzhou/deepseek-v4-flash-mi300x)（Ryan Zhou，2026-08-04）。相关参考：[DeepSeek-V4-Flash-0731 模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731)、[官方 vLLM recipe](https://recipes.vllm.ai/deepseek-ai/DeepSeek-V4-Flash)、[Fergus Finn 的 MI300X 移植工作日志](https://fergusfinn.com/blog/deepseek-v4-flash-mi300x/)、[AMD Instinct MI300X 产品页](https://www.amd.com/en/products/accelerators/instinct/mi300/mi300x.html)。
