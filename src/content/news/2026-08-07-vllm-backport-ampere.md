---
title: "vllm-backport：让 DeepSeek-V4-Flash 跑上 A6000 与 A100"
description: "面向 Ampere 显卡的 vLLM 分支：把 DeepSeek-V4-Flash-0731 的推理支持回移植到 A6000、A100、RTX 30 系，8×A6000 实测 prefill 3435 tok/s、decode 948 tok/s。"
pubDate: 2026-08-07
author: "林晓"
category: "tools"
tags: ["vLLM", "DeepSeek", "A6000", "模型推理", "开源工具"]
image: "/covers/vllm-backport-ampere.jpg"
imageAlt: "DeepSeek-V4-Flash 推理能力回移植到 A6000 显卡的抽象插画"
---

大模型的新推理内核往往优先适配 Hopper 和 Blackwell 等新架构，Ampere 老卡用户常常只能等社区补刀。DeepSeek-V4-Flash-0731 发布后，`vllm-backport` 直接把问题扛了下来：这是一个专门把该模型的推理支持"回移植"到 Ampere 的 vLLM 分支，让 A6000、A100、RTX 30 系甚至 RTX 4090 都能跑起这款 166.9 GB 的量化模型。

## 项目是什么

[wtdcode/vllm-backport](https://github.com/wtdcode/vllm-backport) 是 vLLM 的一个 fork（Apache-2.0），默认分支 `dsv4-a6000-opt`，定位非常明确：在 Ampere 上跑 DeepSeek-V4-Flash-0731。项目创建于 2026 年 8 月初，迭代很快——从提交记录看，核心工作是从社区 [haosdent/vllm](https://github.com/haosdent/vllm) 的 `dsv4-flash-a100` 分支回移植 DSv4 性能优化，并合入了 vLLM 上游的多个修复（确定性 top-k、DSML orphan-invoke 恢复、island-aware allreduce 等）。

镜像采用**单架构构建**（sm80/sm86/sm89），不编译 FA3/Hopper 内核，因此体积和启动速度都更适合老显卡。每次推送会自动构建并发布到 Docker Hub，同时提供固定版本 tag 方便复现。

## 为什么要专门"回移植"

DeepSeek-V4-Flash-0731 的架构相当特殊：MLA 注意力、256 路由专家、稀疏注意力 indexer、mHC 预归一化，再叠加 DSpark 投机解码（MTP5）。这些路径在 Blackwell/Hopper 上有专门优化的内核，但老架构上要么没有实现，要么存在正确性问题。`vllm-backport` 补的正是这几类短板：

- **确定性**：MoE token 分组改为稳定排序、固定 decode 的 split-k、按固定 token 桶填充 batch，让相同请求在不同并发下输出一致，也避免 GEMM tiling 随 batch 大小抖动
- **稳定性**：sparse-indexer prefill logits 分块处理，修复长上下文（约 134k tokens 以上）崩溃问题，是跑到 256k+ 上下文的前提；还修了 KV cache 新建块清零误伤活跃块、DSML orphan-invoke 恢复等 bug
- **性能**：从 A100 分支回移植 prefill/decode 内核优化，支持多 PCIe island 的分层 all-reduce、增大单次 all-reduce 上限等
- **工具链**：修复 DeepSeek V4 的工具调用解析器（`deepseek_v4`），配合自动工具选择后 Claude Code 等客户端可以正常使用

## 实测性能

README 给出的基准是 **8 × A6000（TP=4、PP=2）下 prefill 3435 tok/s、decode 948 tok/s**，并说明 A100 同样适用。考虑到模型量化后约 166.9 GB、还要在 100 万上下文下保留 KV cache，8 张 48 GB 的 A6000（合计 384 GB）确实是这套 fork 的主要目标配置；TP=8 时每卡只需要承载约 21 GB 权重，余量充足。

更值得关注的是 decode 吞吐：DeepSeek-V4-Flash 依赖 DSpark 投机解码来维持单卡/小集群上的生成速度，这个 fork 把草稿采样链融合成单一算子（`VLLM_DSPARK_FUSED_MARKOV`），并支持 vocab 分片减少草稿侧的跨卡通信，让老卡也能吃到投机解码的红利。

## 快速开始：Docker

按 GPU 架构选择镜像 tag：

| 镜像 tag | 适用 GPU |
|---|---|
| `lazymio/vllm-backport:latest` / `:latest-sm86` | Ampere sm86：A6000、RTX 30 系 |
| `lazymio/vllm-backport:latest-sm80` | Ampere sm80：A100 |
| `lazymio/vllm-backport:latest-sm89` | Ada sm89：RTX 4090、L40S（需设置 `VLLM_TEST_FORCE_FP8_MARLIN=1`） |
| `:v0.2.0-sm86` / `-sm80` / `-sm89` | 固定版本发布构建 |

镜像入口就是 `vllm serve`，用 Docker Compose 起一个 8 卡服务：

```yaml
services:
  vllm:
    image: lazymio/vllm-backport:latest-sm86  # A100 换成 :latest-sm80
    command: >
      deepseek-ai/DeepSeek-V4-Flash-0731
      --tensor-parallel-size 8
    ports:
      - "8000:8000"
    volumes:
      - ~/.cache/huggingface:/root/.cache/huggingface
    environment:
      - HUGGING_FACE_HUB_TOKEN=${HUGGING_FACE_HUB_TOKEN:-}
    ipc: host          # 多卡张量并行必需
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

```bash
docker compose up -d
curl http://localhost:8000/v1/models
```

多卡张量并行必须设置 `ipc: host`；如果容器 `/dev/shm` 很小且没法用 `--ipc=host`，可以把环境变量 `VLLM_MQ_MAX_CHUNK_BYTES_MB` 调低（例如 1 MB）。

## 推荐启动参数

```bash
vllm serve /path/to/your/deepseek \
  --tensor-parallel-size 8 \
  --max-model-len 1048576 \
  --gpu-memory-utilization 0.90 \
  --kv-cache-dtype fp8_ds_mla \
  --trust-remote-code \
  --compilation-config '{"cudagraph_mode":"PIECEWISE"}' \
  --speculative-config '{"method":"dspark","num_speculative_tokens":5}' \
  --enable-auto-tool-choice --tool-call-parser deepseek_v4 \
  --host 0.0.0.0 --port 8000 \
  --hf-overrides '{"head_dtype": "float32"}' \
  --served-model-name deepseek-v4-flash
```

几个值得注意的点：

- `--kv-cache-dtype fp8_ds_mla` 是 DeepSeek-V4 专用的 MLA KV 缓存格式，不开它百万上下文基本放不下
- `--speculative-config` 启用 DSpark 投机解码（5 个草稿 token），这是 decode 速度的关键
- `--hf-overrides '{"head_dtype": "float32"}'` 把输出头切成 fp32，README 明确说可以明显减少"垃圾输出"（乱码/重复）
- `--enable-auto-tool-choice` + `deepseek_v4` 解析器让 Claude Code 等工具调用场景正常工作
- TP 和 PP 按你的卡数调整，但注意 **PP>1 时 DSpark 投机解码效果明显变差**，README 建议优先用 TP

## 默认开启的确定性开关

这个 fork 的独特之处在于默认就开启一组保证"结果可复现"的开关，理论上不需要用户干预：

| 环境变量 | 默认 | 作用 |
|---|---|---|
| `VLLM_DETERMINISTIC_MOE_ALIGN` | `1` | MoE token 分组用稳定排序，不再依赖原子操作顺序 |
| `VLLM_DSV4_FIXED_DECODE_SPLITS` | `16` | 固定稀疏 decode 的 split-k，结果不随同批其他请求变化 |
| `VLLM_TOKEN_BUCKET_PAD` | `1` | 按 16/32/64/128/256 的 token 桶填充 batch，稳定 GEMM tiling |
| `VLLM_DSPARK_FUSED_MARKOV` | `1` | 融合 DSpark 草稿采样链，比 eager 算子链更快 |
| `VLLM_DSV4_LOGITS_ROW_CHUNK` | `128` | 分块计算 indexer prefill logits，修复 134k tokens 以上崩溃，256k+ 必需 |

另有 `VLLM_MHC_PRENORM_SHARD`、`VLLM_UNREPLICATE_ATTN_GEMMS`、`VLLM_DSPARK_VOCAB_SHARD`、`VLLM_HIER_ALL_REDUCE` 等一批**可选性能开关**，默认关闭——README 提醒先在对应拓扑上实测再开，例如 mHC prenorm 分片在 TP=8 有收益、在 TP=4 反而变慢。

## 项目状态与注意

这是一个非常新的社区项目（2026 年 8 月初创建），目前通过 Docker Hub 分发，`latest` 跟踪主分支、`v0.2.0` 等 tag 用于固定版本。以下几点在采用前值得知晓：

- 镜像只覆盖 sm80/sm86/sm89 三种架构，Hopper（sm90）用户直接用官方 vLLM 即可
- sm89 需要额外设置 `VLLM_TEST_FORCE_FP8_MARLIN=1`，README 没有展开解释，建议按官方镜像行为理解
- 项目处于快速迭代期，README 也在频繁更新，生产使用建议 pin 版本 tag 而不是追 `latest`

## 核心总结

- **定位清晰**：把 DeepSeek-V4-Flash-0731 的推理支持回移植到 Ampere/Ada，A6000、A100、RTX 30 系、RTX 4090 都能跑
- **性能可观**：8×A6000 实测 prefill 3435 tok/s、decode 948 tok/s，DSpark 投机解码是关键
- **拿来即用**：按架构选 Docker tag，一条 Compose 起服务，推荐参数已在 README 给出
- **工程讲究**：默认开启确定性开关，长上下文崩溃、KV cache 误清、工具解析等坑都被单独修过
- **注意边界**：PP>1 影响投机解码；sm89 需额外环境变量；新项目建议用版本 tag 部署

原文：[vllm-backport GitHub 仓库](https://github.com/wtdcode/vllm-backport) · [Docker Hub 镜像](https://hub.docker.com/r/lazymio/vllm-backport) · [DeepSeek-V4-Flash-0731 模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731)
