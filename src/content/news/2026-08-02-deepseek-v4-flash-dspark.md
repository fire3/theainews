---
title: "DeepSeek-V4-Flash-0731 DSpark：Gilded Gnosis r16 定版镜像发布"
description: "DeepSeek-V4-Flash-0731 的 Gilded Gnosis r16 镜像通过全部门禁：内置 DSpark K5 投机解码、InstantTensor 加载与可选原生 CPU KV 卸载。"
pubDate: 2026-08-02
author: "林晓"
category: "models"
tags: ["DeepSeek", "DSpark", "vLLM", "投机解码", "推理部署"]
image: "/covers/ds4-dspark.svg"
imageAlt: "DeepSeek-V4-Flash-0731 的 Gilded Gnosis r16 DSpark 推理镜像"
---

local-inference-lab 发布了 `deepseek-ai/DeepSeek-V4-Flash-0731` 的统一 **Gilded Gnosis r16** 版本。该版本在 GLM-5.2 所使用的同一条镜像线路上，加入了持续维护的 DSpark 启动器、固定 K5 发布配置、InstantTensor 加载，以及可选的原生 CPU KV 卸载。

> **发布状态：已发布。** 该镜像通过了源码合成、构建、启动器、依赖、单元测试、无卸载与原生卸载端到端（E2E）等全部门禁。

## 发布镜像

```text
voipmonitor/vllm:gilded-gnosis-v20-vllm1e9c9c3-sieec30ff-fi801d57a-cu132-20260731-r16
Docker manifest: sha256:48518e91cf87dd0c0483c76ff86e81dfc0f46de7e364b46f7a82c481ce08188f
本地镜像 ID: sha256:82adcb63671885fd61a8335c58d16bead5162ad1dee36e268d21707d8e8a2a15
本地大小: 25,184,893,615 字节
```

## 启动 DSpark K5

启动助手已内置在镜像中，用户只需一份小型 Compose 文件，无需再下载或挂载单独的 server 脚本。

```bash
git clone https://github.com/local-inference-lab/blackwell-llm-docker.git
cd blackwell-llm-docker

GPUS=0,1 \
  docker compose -f examples/docker-compose-ds4-v20-r16.yml up -d
```

发布版 Compose 默认配置：

| 配置项 | 默认值 | 含义 |
|---|---:|---|
| `MODE` | `dspark` | 针对 0731 检查点的原生 DSpark 服务 |
| `BACKEND` | `b12x-a8` | SparkInfer/B12X W4A8 目标路径 |
| `TP_SIZE` / `DCP_SIZE` | `2` / `1` | 经过验证的 DSpark 拓扑 |
| `DSPARK_DEPTH_MODE` | `fixed` | 固定草稿深度；动态置信度控制保持可选 |
| `DSPARK_TOKENS` | `5` | 发布版 K5 配置 |
| `MAX_NUM_SEQS` | `16` | 调度器并发数 |
| `MAX_MODEL_LEN` | `131072` | 保守的发布上限 |
| `MAX_NUM_BATCHED_TOKENS` | `8192` | prefill 调度预算 |
| `GPU_MEMORY_UTILIZATION` | `0.975` | GPU 内存占用目标 |
| `LOAD_FORMAT` | `instanttensor` | 必选的默认模型加载器 |
| `INSTANTTENSOR_BACKEND` | `BUFFERED` | 复用 Linux 页缓存中的检查点页面 |
| `KV_OFFLOADING_SIZE` | `0` | 除非显式指定，否则关闭原生 CPU KV 卸载 |

辅助脚本会根据 `MAX_NUM_SEQS` 与所选草稿深度计算图容量上限。即使通用启动器把 K7 作为中性默认值，这份 Compose 文件也刻意选择了 K5。

## 为什么选 K5

在 TP2 匹配条件下，持续单用户解码时 K5 优于 K7：

| 草稿深度 | 持续解码 | 编码中位数 |
|---|---:|---:|
| K5 | 217.8 tok/s | 289.4 tok/s |
| K7 | 192.1 tok/s | 281.2 tok/s |

K5 在持续解码上快 13.3%，编码探针也没有回退。社区反馈同样显示，K5 不太容易出现超长的低接受率序列。如需做与上游匹配的对照实验，可显式使用 K7：

```bash
DSPARK_TOKENS=7 GPUS=0,1 \
  docker compose -f examples/docker-compose-ds4-v20-r16.yml up -d
```

动态置信度控制深度仍然可用，但不是发布默认值：

```bash
DSPARK_DEPTH_MODE=dynamic GPUS=0,1 \
  docker compose -f examples/docker-compose-ds4-v20-r16.yml up -d
```

## 原生 CPU KV 卸载

原生卸载与 LMCache 相互独立，按需启用。按所有 TP rank 的总量设置主机端容量（GiB）：

```bash
KV_OFFLOADING_SIZE=48.5 GPUS=0,1 \
  docker compose -f examples/docker-compose-ds4-v20-r16.yml up -d
```

支持正十进制与非 2 的幂容量。`0`、`0.0` 或未设置都会关闭该功能。启动器会把正值展开为：

```text
--kv-offloading-size <GiB> --kv-offloading-backend native
```

r16 使用一个进程共享的主机卸载区域，而非独立的 2 的幂 pinned 分配。重放保留机制还保留了滑动窗口注意力、MTP/EAGLE 尾部、配置的保留间隔、最近的重放边界，以及 GG 共享前缀边界。

最终发布门禁在精确的发布镜像上验证了以下全部内容：

1. 关闭原生卸载时的常规 K5 服务；
2. 使用十进制、非 2 的幂卸载大小启动模型；
3. 真实的存储与重放命中，而不只是 CLI 解析成功；
4. 输出连贯，且与无卸载运行相比没有实质性的解码回退。

不要在同一个测试中启用 `LMCACHE_MODE`。原生卸载与 LMCache 是两套独立的缓存实现，应分开验证。

常规连接器拆卸会关闭并取消链接共享 mmap。强制的 `SIGKILL` 无法执行这一清理，可能留下孤儿文件 `/dev/shm/vllm_offload_*.mmap`。容器崩溃或被强制移除后，删除该文件前请确认没有任何 vLLM 进程仍在引用它。

## 上下文长度

`131072` 是保守的发布默认值，而非模型上限。社区运行在 4096 批 token 预算下报告约 65 万 token，在 2048 预算下最高可达 100 万 token，但这些上限未经 r16 门禁认证。只有在同时调整合适的批 token 预算、并做真实长上下文测试的情况下，才应提高 `MAX_MODEL_LEN`。

## 源码溯源

| 组件 | 版本引用 |
|---|---|
| Canonical GG base | `30038602b71395f481ef4a6edfe4fcf8551d9c15` |
| Composed vLLM tree | `1e9c9c3475fa30ab48d5639f8882f1e93bb552bf` |
| SparkInfer base | `b0976b7fd46b5d34357a5f615822b86792676feb` |
| Composed SparkInfer tree | `eec30ff294c1870b59a04686fff6608fddb62089` |
| FlashInfer | `801d57a08958c13d375ddbb6be3be4808f48a708` |
| LMCache composed tree | `a5aa59cc8edca462a3f4c198d17fd2b9c1a7ffaa` |
| InstantTensor | `85e7c5f5539d9c006ee0c26bc1b5233c65251b6b` |
| NCCL | local-inference `2.30.4`，CUDA 13.2 构建 |
| PyTorch / CUDA | `2.12.0+cu132` / `13.2.1` |

发布专属的 vLLM 改动：

| PR | 用途 |
|---|---|
| [#214](https://github.com/local-inference-lab/vllm/pull/214) | 0731 DSpark 启动器与原生卸载环境控制 |
| [#217](https://github.com/local-inference-lab/vllm/pull/217) | 共享原生 CPU 卸载区域；十进制/非 2 的幂容量 |
| [#218](https://github.com/local-inference-lab/vllm/pull/218) | SWA、MTP、重放、保留间隔与共享前缀保留 |

发布归档还保留了 vLLM #145、#212、#213 与 SparkInfer #106。出现在发布镜像中的 PR 并不代表其被隐式授权合并。

## 重新构建

权威构建脚本与发布清单如下：

- [`build-gilded-gnosis-v20-final-cu132.sh`](https://github.com/local-inference-lab/blackwell-llm-docker/blob/main/build-gilded-gnosis-v20-final-cu132.sh)
- [`manifests/vllm/gilded-gnosis-v20.json`](https://github.com/local-inference-lab/blackwell-llm-docker/blob/main/manifests/vllm/gilded-gnosis-v20.json)
- [`examples/docker-compose-ds4-v20-r16.yml`](https://github.com/local-inference-lab/blackwell-llm-docker/blob/main/examples/docker-compose-ds4-v20-r16.yml)

```bash
git clone https://github.com/local-inference-lab/blackwell-llm-docker.git
cd blackwell-llm-docker

VLLM_RELEASE_COMPOSITION=reproduce-r16 \
  ./build-gilded-gnosis-v20-final-cu132.sh
```

发布归档在构建前会校验精确的基础提交、PR 头部、合成树与补丁哈希。

## 验证

- 干净的源码合成与不可变归档复现：通过
- 全部构建/辅助 shell 测试套件：通过
- LMCache 集成套件：219 通过，131 跳过
- 原生卸载分配测试：39 通过
- 原生卸载保留测试：7 通过
- DS4 启动器测试：10 通过
- 镜像运行时导入、NCCL 链接、XGrammar、InstantTensor 与源码契约门禁：通过
- 无卸载 TP2/DCP1 DSpark K5 模型加载与连贯输出：通过
- 无卸载持续 CC1 解码：220.6 tok/s
- 使用十进制 5.5 GiB 容量的原生卸载：通过
- 重复的原生卸载持续 CC1 解码：222.9 tok/s，对无卸载基线无实质回退
- 70k/80k/100k 前缀序列：GPU 到 CPU 存储 5.22 GB
- 70k 重放：CPU 到 GPU 加载 635.5 MB，69,888 次外部前缀缓存命中
- 运行时错误特征扫描：通过

原文：[DeepSeek-V4-Flash-0731 DSpark: Gilded Gnosis r16](https://github.com/local-inference-lab/rtx6kpro/blob/master/models/ds4dspark-v20.md)（local-inference-lab，2026-07-31）
