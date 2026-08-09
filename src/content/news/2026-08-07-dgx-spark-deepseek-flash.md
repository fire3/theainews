---
title: "两台 DGX Spark 跑 DeepSeek-V4-Flash：部署要点与实测效果"
description: "用 200GbE 直连的双 DGX Spark 以 vLLM 部署 DeepSeek-V4-Flash-0731（TP=2、百万上下文），单流 60–70 tok/s，本文梳理关键注意事项与实测数据。"
pubDate: 2026-08-07
author: "林晓"
category: "tutorial"
tags: ["DGX Spark", "DeepSeek", "vLLM", "DSpark", "多机部署"]
image: "/covers/dgx-spark-deepseek-flash.jpg"
imageAlt: "两台 DGX Spark 通过 200GbE 直连协同推理的抽象插画"
---

DeepSeek-V4-Flash-0731 的量化权重就有 166.9 GB，单台 DGX Spark（GB10，128 GB 统一内存）虽然能加载，但想要同时吃下 100 万 token 的上下文窗口和可用的并发能力，就需要两台机器组队：每台各扛一半模型分片，通过 200GbE 高速互联做张量并行（TP=2）。一位开发者把整个部署过程整理成了可逐步复现的手册（[maliubiao/dgx-spark-2-deepseek-flash-0731](https://github.com/maliubiao/dgx-spark-2-deepseek-flash-0731)），包括硬件拓扑、集群配置、NCCL 验证、模型下载、启动调优和长跑实测。本文基于这份材料，梳理最值得注意的问题和最终效果。

## 方案概览

整套方案的软硬件选型如下：

| 组件 | 配置 |
|---|---|
| 硬件 | 2 × NVIDIA DGX Spark（GB10、Blackwell sm_121、128 GB 统一内存） |
| 互联 | QSFP112 DAC 直连（400GbE 以太网模式，协商 200G），RoCE 网络 |
| 模型 | `deepseek-ai/DeepSeek-V4-Flash-0731`，I8/FP4 量化，166.9 GB / 74 文件 / 48 分片 |
| 推理引擎 | vLLM（`ghcr.io/anemll/dspark-vllm-gx10:0.1.1`），TP=2，DSpark MTP5 投机解码 |
| KV cache | `nvfp4_ds_mla`，双机共享约 183 万 token，`max_model_len=1048576` |

对外暴露的是 OpenAI 兼容接口（`http://<head-IP>:8888/v1`），客户端可以直接按 OpenAI 格式调用，冷启动约 6–9 分钟。

## 最值得注意的问题

**1. 线缆必须是官方型号，且"一根线 = 两个链路"**

每台 DGX Spark 有 2 个 QSFP 物理口，每个物理口在 Linux 下映射为 2 个网口（ConnectX-7 双 PCIe x4 链路，各 100G，合计 200G）。所以插一根线，两端各亮两个口是正常的，不要误以为要插两根线；同一链路上插两根线也不会提速。普通 100G/25G 线缆协商不到 200G，必须用官方列出的 QSFP112 DAC 型号（如 Amphenol NJAAKK-N911、Luxshare LMTQF022-SD-R），接线后 `ethtool` 应显示两个链路均为 `Speed: 200000Mb/s`。

**2. 系统版本必须 ≥ 2026-04，升级后务必重启**

Cluster Assistant 要求系统软件 ≥ 2026-04。升级工具是系统自带的 `nvidia-spark-ota-check`（不存在 `nv-ota` 命令），确认 `torn-score: 0`、驱动 580.x、CUDA 13.0 后还要**重启**——手册作者遇到过驱动模块与内核不一致导致 `nvidia-smi` failed 的情况，重启即恢复。

**3. 集群测速只有 25G 时，先重启而不是拔线**

用 NVIDIA Sync 的 Cluster Assistant 创建双机集群时，Link Speed Test 要求下限 184 Gbit/s。作者实测首次测速只有 25G，期间反复插拔线缆均无效，**重启两台（线保持插着）后直接恢复 200G+**——网络计划写入 netplan 后需要重启生效。后续 iperf3 实测两条链路各约 107 Gbit/s，合计约 214 Gbit/s。

**4. NCCL 要自己编译，GID 索引会漂移**

系统自带的 NCCL 可能不支持 Blackwell sm_121，需要从源码编译（tag v2.30.7-1，`NVCC_GENCODE="-gencode=arch=compute_121,code=sm_121"`），再用 nccl-tests 做双机 all_gather 验证，预期 busbw 约 21 GB/s（≈171 Gbit/s）。最容易踩的坑是 RoCEv2 GID 索引在重启后漂移，报 `ibv_modify_qp` / unhandled system error——启动脚本默认 `NCCL_IB_GID_AUTO=1` 自动解析即可，不必手工填。

**5. 166.9 GB 模型下载：网络是大坑，校验必须做**

模型非门控，无需 HF token。但在中国大陆网络下，huggingface.co 直连不通、走代理几乎 0 MB/s、Xet 协议直接 403——**必须设置 `HF_HUB_DISABLE_XET=1`**，改用 hf-mirror.com 直连（分块并发 30–40 MB/s，约 1.5–2.5 小时下完）。校验清单来自 HF API 的 LFS oid（权威 sha256），不要信任第三方 SHA256SUMS；仓库自带的分块下载器支持断点续传、文件级 sha256 校验和失败自动重下。TP=2 要求每个 rank 都读全部权重，所以模型要**双机各存一份**，经 200G 内网 rsync 同步（约 450–500 MB/s，6 分钟完成）后再在 worker 上全量复核。

**6. 镜像拉取限速用国内镜像，但要逐层比对 digest**

`ghcr.io` 的 blob 下载在大陆会被限速到约 17 KB/s，可改用 `ghcr.nju.edu.cn` 镜像（约 24 MB/s）再打回官方 tag。安全起见，拉取后要与官方 manifest 逐层比对（44 层 digest + config digest 一致），最终 digest 为 `sha256:a8394849…`。

**7. `DEFAULT_THINKING=max` 会让压测"跑飞"**

这是手册里特别强调的一个坑：`max` 思考级别下模型会产生超长推理链，单个请求可能输出数万 token、耗时 10–20 分钟甚至更久。日常对话没问题，但**做压测前必须把 `.env.dspark` 的 `DEFAULT_THINKING` 改为 `low` 或 `off` 并重启服务**，否则基准数据完全不可用。

**8. 内核与内存加固**

社区记录过：高负载下内存压缩线程 `kcompactd` 触发 soft-lockup、NVIDIA `mstflint` 轮询导致内核 NULL-deref 整机重启。防御手段是设置 `vm.compaction_proactiveness=0`；若系统装了 earlyoom 建议禁用，防止误杀 vLLM 进程。另外日志里的 `mlx5_core insufficient power 27W` 是 GB10 集成 ConnectX-7 的正常现象，不是故障。

## 实测效果

部署完成后的性能数据（DSpark MTP5、NVFP4 DS-MLA、TP=2）：

| 指标 | 实测/预期 |
|---|---|
| 单流 decode（含推理） | 约 60–80 tok/s，热机 78–80 tok/s |
| prefill | 372 token 提示约 99 tok/s，短提示可达约 2000 tok/s |
| DSpark 投机接受率 | 约 91%（平均接受长度 5.5+） |
| GPU 利用率 | 约 95% |
| KV 池 | 双机约 183 万 token，1M 上下文下并发约 1.75× |
| 高并发聚合（社区，thinking=off） | 最高约 340 tok/s |

更值得注意的是长跑体验：作者用这套系统连续数小时跑 Agent / Vibe Coding（开发一个双机监控面板），单会话稳定在 **60–70 tok/s**，全程无 OOM、无 NCCL 抖动，GPU 温度约 **70°C**（离 90°C+ 热墙余量充足）。结论是"完全能用、使用体验不错"——不是能跑起来的演示水平，而是可以当主力开发机稳定干活。KV 池是双机共享的，总在线 token 不超过约 183 万，长上下文和高并发之间存在互斥，这是规划负载时要知道的上限。

作者还配套写了一个实时监控面板（[dgx-spark-2-deepseek-flash-dashboard](https://github.com/maliubiao/dgx-spark-2-deepseek-flash-dashboard)），实时展示 GPU 利用率/温度/功耗、decode 吞吐、投机解码接受率、KV cache 与 prefix 命中率。下面是运行实况截图：

![监控面板实时总览](/images/dgx-spark-panel-overview.png)

![GPU、主机与吞吐](/images/dgx-spark-panel-gpu.png)

![性能详情](/images/dgx-spark-panel-perf.png)

## 复现路径

手册把全过程拆成了十章：硬件拓扑 → 系统初始化/OTA → 用户与 SSH/网络 → NVIDIA Sync + Cluster Assistant 建集群 → NCCL 编译验证 → 模型下载与校验 → 部署启动 → 验证与压测 → 运维排障 → 附录（版本 pin 与参考索引）。复现前先把 `VARIABLES.md` 里的全部 `<占位符>` 替换成自己的实际值，再按章节执行即可。快速开始：

```bash
# 前置：两台联网可 SSH 的 DGX Spark（系统 ≥ 2026-04）、一根 QSFP112 DAC、装有 NVIDIA Sync 的电脑
# 1. 硬件接线 → 系统升级 → SSH 免密（01–03 章）
# 2. NVIDIA Sync → Cluster Assistant 建集群（04 章）
# 3. 编译并验证 NCCL（05 章）
# 4. 下载并校验模型，双机各存一份（06 章）
# 5. 部署：./start-deepseek-v4-flash-dspark.sh（07 章）
# 6. 验证：curl http://<head-IP>:8888/v1/models
```

## 核心总结

- **硬件与网络是基础**：官方型号 QSFP112 DAC、系统 ≥ 2026-04、重启解决 25G 测速问题
- **NCCL 与 GID**：sm_121 需自编译 NCCL，RoCEv2 GID 索引漂移用自动解析规避
- **下载与校验**：国内网络走 hf-mirror + 禁用 Xet，用官方 LFS oid 做 sha256 复核；镜像 digest 逐层比对
- **调参与加固**：压测前 `DEFAULT_THINKING=low/off`，设置 `vm.compaction_proactiveness=0` 防内核崩溃
- **效果**：单会话 60–70 tok/s、GPU 约 70°C、连续长跑不崩溃，双 DGX Spark 完全能胜任 DeepSeek-V4-Flash 的主力开发机角色

原文：[dgx-spark-2-deepseek-flash-0731 复现手册](https://github.com/maliubiao/dgx-spark-2-deepseek-flash-0731) · [DeepSeek-V4-Flash-0731 模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash-0731) · [Anemll DSpark 镜像](https://github.com/Anemll/dspark-vllm-gx10)
