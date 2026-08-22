---
title: "SGLang 秒级重启：Weight Cache Daemon 把权重加载从 495s 压到 0.63s"
description: "SGLang 引入 Weight Cache Daemon：常驻 GPU 进程用 CUDA IPC 零拷贝复用权重，加载提速约 785 倍、端到端启动缩短 93.9%，目标 <10s 冷启动、<1s 热备切换。"
pubDate: 2026-08-22
author: "林晓"
category: "tools"
tags: ["SGLang", "LMSYS", "推理引擎", "GPU", "CUDA IPC", "高可用", "LLM Serving"]
topStory: true
image: "/covers/2026-08-22-sglang-fast-recovery.jpg"
imageAlt: "高对比深色杂志风封面：SGLang 秒级重启，琥珀色强调，中央超大 785× 数字与权重缓存计算注射意图"
---

模型越来越大，推理引擎的冷启动就越来越痛。Ling-2.6-1T 这类万亿级模型，重启一次要等 **8.8 分钟**才能重新接客。LMSYS 联合蚂蚁、阿里的团队正是冲着这个痛点，在 SGLang 里引入了 **Weight Cache Daemon**（权重缓存守护进程）：让权重常驻 GPU 显存，引擎重启时用 CUDA IPC **零拷贝**直接映射，把权重加载从分钟级压到亚秒级。

这是 SGLang **Fast Engine Recovery Framework（快速恢复框架）**的第一阶段，最终目标是对生产推理服务做到 **<10 秒冷启动、<1 秒热备切换**。

## 核心结果

| 指标 | 之前 | 之后 | 提升 |
|---|---:|---:|---:|
| 权重加载（Ling-2.6-1T FP8）| ~495s | ~0.63s | **约 785×** |
| 端到端引擎启动 | 8.8 min | 0.528 min | **缩短 93.9%** |
| 热备故障切换 | — | <1s（零拷贝共享权重）| 近零停机 |

## 时间都花哪了？

团队对 Ling-2.6-1T FP8 一次完整启动做了逐阶段画像：**权重从磁盘加载独占 93.2% 的时间**。每个 TP rank 要从磁盘读约 120GB 的 safetensors，反序列化、做 TP 分片、再跑一遍后量化变换（FP8 量化、权重 repack）。这些工作在每次重启时都**一模一样地重复**——可结果张量是确定性的，而且往往已经在显存里躺着了。既然如此，何必每次从磁盘重读？

| 阶段 | 耗时 | 占比 | 说明 |
|---|---:|---:|---|
| 加载权重（磁盘 I/O 瓶颈）| ~495s | 93.9% | 161 分片、W8A8 FP8，最慢 rank 495s |
| Tokenizer 初始化 | ~13s | 2.4% | 加载并初始化 |
| Init torch 分布式 | ~5s | 0.9% | NCCL、8 卡 H20、NVLink mesh |
| 其他（CUDA graph、Server ready 等）| ~14s | 2.7% | — |
| 合计 | ~527s | 100% | 约 8.8 分钟 |

## 设计：持久权重缓存 + CUDA IPC

Weight Cache Daemon 是一个**常驻 GPU 进程**，把"后量化 + TP 分片后的权重"常驻在显存中。引擎重启时，新进程通过 CUDA IPC 从守护进程**零拷贝映射**权重——没有磁盘 I/O、没有反序列化、没有重复量化。每张 GPU 上跑一个守护进程，对应自己的 TP rank。

守护进程负责：从磁盘加载权重（磁盘 → TP 分片 → 量化 → repack 的完整流水线）→ 把 `state_dict()` 里每个参数/缓存导出为 CUDA IPC handle → 记录 CacheConfig 指纹 → 通过 Unix socket 把 IPC handle 提供给请求的引擎进程。引擎连上守护进程后，校验配置兼容性，把参数指针直接指到 IPC 映射的显存张量上，**不拷贝任何数据**。

实现零拷贝的关键是 **meta device**：引擎先在 meta device 上初始化模型（不分配显存），再用 IPC 映射的张量替换每个参数的 `data` 指针。后量化产生的参数（如 FP8 量化的 `weight_scale`）也被守护进程缓存并直接映射，无需重新量化。

## 安全第一：配置校验 + IPC 允许清单

任何配置不匹配都会触发**完整磁盘重载**，宁可慢也不出错。校验字段包括：`model_path / model_arch / revision`（模型对不对）、`tp_size/tp_rank`、`pp_size/pp_rank`、`dp_size/ep_size`、`quant_method + quant_config_hash`、`dtype`、以及 `device_capability + torch_version` 构成的**环境戳**——后两项把"能干净映射但数值是错的"硬转成明确的不匹配，避免守护进程和客户端走了不同后处理分支时悄悄产出垃圾权重。

此外，量化方法受 **IPC 允许清单**门控。CUDA IPC 零拷贝只导出原始张量数据，只有当 `process_weights_after_loading()` 的全部效果都落在这些数据上时才是正确的；像 per-tensor FP8、Marlin、AWQ/GPTQ 这种会在 Python 侧盖章元数据或 repack/转置权重的方法，会直接**抛硬错误**而不是静默产出错误数值。目前验证通过的是 unquantized 与 block-wise FP8，更多方法在端到端验证后陆续加入。

## 三种模式

| 模式 | 流程 | 权重加载 | 显存 | 适用 |
|---|---|---|---|---|
| **daemon** | 引擎拉起守护进程 → 从磁盘加载 → 引擎映射 IPC | <1s（守护就绪后）| 1×（共享）| 首次启动，引擎托管守护进程生命周期 |
| **client** | 连接已运行的守护进程 → 映射 IPC | <1s | 1×（共享）| 引擎重启，守护进程预先运行（快恢复主路径）|
| **off** | 普通从磁盘加载 | 405–411s | 1× | 默认，不缓存 |

## 不止重启：解锁的生产场景

- **多实例权重共享**：每 GPU 一个守护进程，多个引擎实例（比如独立的多个服务）零拷贝映射同一批 IPC handle。无论多少个实例消费，每个 GPU 上权重**只从磁盘加载和量化一次**。
- **优先级共服务**：同 GPU 上跑高优先级在线服务 + 低优先级批任务，共享同一守护进程。低优先级实例可在亚秒内被驱逐再重生，无需重载权重，灵活分时。
- **主动-被动故障切换**：主备引擎共享同一守护进程，备机零拷贝映射权重保持热态；主故障时备机 **<1 秒**接管，无需为闲置副本独占整组 GPU——对比传统热备部署能省下一倍硬件成本。

## 实测性能

| 模型 | 权重 | 磁盘加载 | IPC 零拷贝 | 加速 |
|---|---:|---:|---:|---:|
| Qwen3-235B FP8 | ~235 GB | ~306–327s | <1s | **约 500×** |
| Ling-2.6-1T | ~1TB | ~405–411s | <1s | **约 780×** |

## 怎么用

单节点一次性拉起所有 TP rank 的守护进程：

```bash
python -m sglang.srt.weight_cache.daemon \
  --model-path /path/to/model --tp-size 4 \
  --load-format auto --dtype auto --quantization fp8

# 就绪检查（每个 rank 写一个 .ready 文件）：
ls /tmp/sglang_weight_cache_rank*.ready
```

启动引擎、以 client 模式连接已运行的守护进程（快恢复主路径）：

```bash
python -m sglang.launch_server \
  --model-path /path/to/model --tp-size 4 \
  --weight-cache-mode client
```

**多节点**：每个节点跑自己的守护进程并加入同一个分布式组，`--nnodes / --node-rank / --dist-init-method` 各节点需一致，`$MASTER_ADDR` 指向 node 0；守护进程与引擎客户端使用**不同的 rendezvous 端口**（守护 29500，客户端 29600）。

## 路线图：不止 Weight Cache

Fast Engine Recovery Framework 目标 **<10 秒冷启动、<1 秒热备切换**。当前阶段（Phase 1）已覆盖 TP + PP、单/多节点、per-GPU 零拷贝 CUDA IPC、unquantized + block-wise FP8。后续规划还包括：CUDA graph 序列化、DeepGEMM JIT 预热缓存、惰性 tokenizer 初始化、NCCL session 复用、KV cache 恢复（在途上下文跨重启存续），以及扩展到更多量化方法、DP/EP、多模态与 LoRA、RL 在线更新的原地权重刷新、跨机/集群共享等。完整计划公开跟踪在 [sgl-project/sglang#33522](https://github.com/sgl-project/sglang/issues/33522)。

## 小结

- SGLang 引入 **Weight Cache Daemon**：让后量化、TP 分片权重常驻显存，重启时 CUDA IPC 零拷贝映射。
- 权重加载从 ~495s 降到 ~0.63s（约 785×），端到端启动缩短 93.9%。
- 配置校验 + IPC 允许清单双保险，安全优先、不匹配自动回退磁盘重载。
- 解锁多实例权重共享、优先级共服务、<1s 热备切换等生产模式。
- 这是 Fast Engine Recovery Framework 第一阶段，目标是 <10s 冷启动、<1s 热备切换。

来源：[LMSYS Org Blog — Fast Engine Recovery: Sub-Second Engine Restart for SGLang via Weight Cache Daemon](https://www.lmsys.org/blog/2026-08-21-sglang-fast-recovery)（蚂蚁 Ling 基础设施团队 + 阿里 + SGLang 团队，2026-08-21）
