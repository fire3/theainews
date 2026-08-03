---
title: "Mooncake × vLLM 实战：用 MooncakeStoreConnector 搭建分布式 KV 缓存池"
description: "手把手部署 vLLM + MooncakeStore 分布式 KV 缓存池：CPU/SSD 卸载、跨实例前缀缓存共享、XpYd 灵活编排，覆盖 V1 与 V0 两种后端。"
pubDate: 2026-08-03
author: "林晓"
category: "tutorial"
tags: ["Mooncake", "vLLM", "KV 缓存", "分布式存储", "PD 分离", "教程"]
---

上一篇教程介绍了用 `MooncakeConnector` 在 prefill 与 decode 实例之间直传 KV 缓存。这篇文章继续深入 Mooncake 与 vLLM 集成的另一半：`MooncakeStoreConnector`。它把 KV 缓存从"点对点搬运"升级为"共享存储池"——多个 vLLM 实例通过分布式存储共享缓存块，支持把 KV 缓存卸载到 CPU 内存/SSD 来扩充容量，还能在运行时动态调整 prefill 与 decode 实例的配比（XpYd 部署）。

本文基于 Mooncake 官方文档，覆盖 vLLM V1（推荐）与 V0（旧版）两套部署流程，从启动 `mooncake_master` 到完成一次请求全流程走通。

## MooncakeStore 能做什么

`MooncakeStoreConnector` 是 vLLM 新的 KV 连接器，它把 `MooncakeDistributedStore`（Mooncake 分布式 KV 缓存池）当作所有实例共享的后端。三个核心能力：

- **CPU/磁盘卸载**：通过 Mooncake 传输引擎把 KV 缓存卸载到 CPU 内存或 SSD，等效扩充单机显存装不下的缓存容量
- **跨实例哈希前缀缓存**：多个 vLLM 实例通过 block-hash 去重共享缓存块，相同前缀只需要算一次
- **灵活部署**：既能当单节点的 KV 缓存扩展（`kv_both`），也能用于 prefill-decode 分离部署（`kv_producer` / `kv_consumer`），并支持 XpYd——运行时动态调整 prefill 与 decode 实例组的大小

相比 Redis 等传统后端，MooncakeStore 的延迟优势明显：官方在 2P2D、tp=2、RDMA 环境下测得平均 TTFT 降低约 **32%**，且在各 XpYd 拓扑下均优于 Redis。

## 选择你的 vLLM 后端

| 后端 | 连接器 | 版本要求 | 状态 | 建议 |
|---|---|---|---|---|
| vLLM V1 | `MooncakeStoreConnector` | 最新版本 | 推荐 | 新部署首选 |
| vLLM V0 | `MooncakeStore` | ≤ v0.6.4.post1 | 旧版（Legacy） | 仅为既有部署保留 |

V1 相比 V0 的两个关键变化：

- **XpYd 支持与编排**：可以在运行时动态改变 prefill 与 decode 实例组的规模
- **更稳定、更容错**：单个 vLLM 实例突然崩溃不影响整体；实例之间不再有直连，每个实例都像一个普通 vLLM 实例，可以独立处理请求

## 使用 vLLM V1（推荐）

### 1. 前置条件

确认 vLLM 与 Mooncake 都已安装。安装与源码编译方法分别参考 [vLLM 官方仓库](https://github.com/vllm-project/vllm) 与 [Mooncake 官方仓库](https://github.com/kvcache-ai/Mooncake)。

### 2. 启动 Mooncake Master 服务器

```bash
mooncake_master --port 50063
```

然后创建 Mooncake 配置文件（例如 `mooncake_config.json`）：

```json
{
  "metadata_server": "http://127.0.0.1:8092/metadata",
  "master_server_address": "127.0.0.1:50063",
  "global_segment_size": "0",
  "local_buffer_size": "2147483648",
  "protocol": "rdma",
  "device_name": ""
}
```

导出环境变量：

```bash
export MOONCAKE_CONFIG_PATH=/path/to/mooncake_config.json
```

### 3. 用法一：单节点 KV 缓存卸载（kv_both）

最简单的方式：只跑一个 vLLM 实例，把 MooncakeStore 当作本地 KV 缓存的扩展，超出显存的部分卸载到 CPU/SSD：

```bash
MOONCAKE_CONFIG_PATH=mooncake_config.json \
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --kv-transfer-config '{"kv_connector":"MooncakeStoreConnector","kv_role":"kv_both"}'
```

### 4. 用法二：XpYd 分离部署（kv_producer / kv_consumer）

要同时获得"点对点直传"与"共享缓存池"两种能力，用 vLLM 的 `MultiConnector` 把两个连接器串起来：`MooncakeConnector` 负责 prefill 与 decode 之间的 KV 直传，`MooncakeStoreConnector` 负责把 KV 缓存写入共享池。

**Prefill 节点**：

```bash
MOONCAKE_CONFIG_PATH=mooncake_config.json \
VLLM_MOONCAKE_BOOTSTRAP_PORT=50052 \
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --port 8100 \
    --kv-transfer-config '{
        "kv_connector": "MultiConnector",
        "kv_role": "kv_producer",
        "kv_connector_extra_config": {
            "connectors": [
                {
                    "kv_connector": "MooncakeConnector",
                    "kv_role": "kv_producer"
                },
                {
                    "kv_connector": "MooncakeStoreConnector",
                    "kv_role": "kv_producer"
                }
            ]
        }
    }'
```

**Decode 节点**：

```bash
MOONCAKE_CONFIG_PATH=mooncake_config.json \
VLLM_MOONCAKE_BOOTSTRAP_PORT=50053 \
vllm serve meta-llama/Llama-3.1-8B-Instruct \
    --port 8200 \
    --kv-transfer-config '{
        "kv_connector": "MultiConnector",
        "kv_role": "kv_consumer",
        "kv_connector_extra_config": {
            "connectors": [
                {
                    "kv_connector": "MooncakeConnector",
                    "kv_role": "kv_consumer"
                },
                {
                    "kv_connector": "MooncakeStoreConnector",
                    "kv_role": "kv_consumer"
                }
            ]
        }
    }'
```

**Proxy**：客户端统一从 proxy 入口访问：

```bash
python examples/disaggregated/disaggregated_serving/mooncake_connector/mooncake_connector_proxy.py \
    --prefill http://192.168.0.2:8100 \
    --decode http://192.168.0.3:8200
```

### 5. 数据并行的注意事项

使用数据并行（DP）时，务必固定 `PYTHONHASHSEED`，保证不同 DP rank 上的 block hash 一致：

```bash
PYTHONHASHSEED=0 vllm serve ...
```

否则相同的提示词在不同 DP rank 上可能算出不同的 block hash，导致跨实例的前缀缓存命中失效。

## 使用 vLLM V0（旧版）

V0 路径面向 ≤ v0.6.4.post1 的既有部署，基于 PR 10502 与 PR 12957，支持节点内与跨节点的 KV 缓存传输。

### 安装

```bash
pip3 install mooncake-transfer-engine
```

> 版本约束：vLLM ≤ 0.8.4 需要 `mooncake-transfer-engine ≤ 0.3.3.post2`；最新版本中 `mooncake_vllm_adaptor` 接口已被弃用。

vLLM 从源码编译：

```bash
git clone git@github.com:vllm-project/vllm.git
cd vllm
pip3 install -e .
```

### 准备 mooncake.json

**RDMA 版本**：

```json
{
  "local_hostname": "192.168.0.137",
  "metadata_server": "etcd://192.168.0.137:2379",
  "protocol": "rdma",
  "device_name": "erdma_0",
  "master_server_address": "192.168.0.137:50001"
}
```

字段含义：

| 字段 | 说明 |
|---|---|
| `local_hostname` | 当前节点的 IP；同一节点上的所有 prefill/decode 实例可共用此配置 |
| `metadata_server` | 元数据服务器，支持 etcd、redis、http 后端 |
| `protocol` | `rdma` 或 `tcp` |
| `device_name` | RDMA 必填，多网卡用逗号分隔，如 `"erdma_0,erdma_1"` |
| `master_server_address` | MooncakeStore master 守护进程的 IP 与端口 |

**TCP 版本**（无 RDMA 环境）：

```json
{
  "local_hostname": "192.168.0.137",
  "metadata_server": "etcd://192.168.0.137:2379",
  "protocol": "tcp",
  "device_name": "",
  "master_server_address": "192.168.0.137:50001"
}
```

### 运行示例

把 IP 与端口替换成自己的环境。注意 V0 后端必须设置 `VLLM_USE_V1=0`。

**1. 启动 etcd 元数据服务**：

```bash
etcd --listen-client-urls http://0.0.0.0:2379 --advertise-client-urls http://localhost:2379
```

运行前可能需要先终止其他 etcd 进程。

**2. 启动 mooncake_master**：

```bash
mooncake_master --port 50001
```

> 如果有 vLLM 实例异常退出，连接元数据可能因未清理而损坏，建议在下一次测试前重启 `mooncake_master`。

**3. 启动多个 vLLM 实例**。生产者为 `kv_producer`、消费者为 `kv_consumer`，注意用 `CUDA_VISIBLE_DEVICES` 区分显卡：

```bash
# kv_producer 角色（端口 8100–8103）
MOONCAKE_CONFIG_PATH=./mooncake.json VLLM_USE_V1=0 python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --port 8100 \
    --max-model-len 10000 \
    --gpu-memory-utilization 0.8 \
    --kv-transfer-config '{"kv_connector":"MooncakeStoreConnector","kv_role":"kv_producer"}'

CUDA_VISIBLE_DEVICES=1 MOONCAKE_CONFIG_PATH=./mooncake.json VLLM_USE_V1=0 python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --port 8101 \
    --max-model-len 10000 \
    --gpu-memory-utilization 0.8 \
    --kv-transfer-config '{"kv_connector":"MooncakeStoreConnector","kv_role":"kv_producer"}'

# kv_consumer 角色（端口 8200–8203）
CUDA_VISIBLE_DEVICES=4 MOONCAKE_CONFIG_PATH=./mooncake.json VLLM_USE_V1=0 python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --port 8200 \
    --max-model-len 10000 \
    --gpu-memory-utilization 0.8 \
    --kv-transfer-config '{"kv_connector":"MooncakeStoreConnector","kv_role":"kv_consumer"}'

CUDA_VISIBLE_DEVICES=5 MOONCAKE_CONFIG_PATH=./mooncake.json VLLM_USE_V1=0 python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --port 8201 \
    --max-model-len 10000 \
    --gpu-memory-utilization 0.8 \
    --kv-transfer-config '{"kv_connector":"MooncakeStoreConnector","kv_role":"kv_consumer"}'
```

需要更多实例时照此模式继续加端口即可（完整示例包含 4 个 producer + 4 个 consumer，这里省略中间部分）。

关键参数：

| 参数 | 说明 |
|---|---|
| `MOONCAKE_CONFIG_PATH` | `mooncake.json` 配置文件路径 |
| `VLLM_USE_MODELSCOPE` | 可选；能访问 HuggingFace 就去掉 |
| `VLLM_USE_V1=0` | 必填：分离特性目前仅支持 V0 vLLM，也可用 `export` 全局设置 |
| `--port` | vLLM 服务监听端口 |
| `--tensor-parallel-size` | 支持；所有实例的 TP 大小必须一致，同机部署用 `CUDA_VISIBLE_DEVICES` 区分（如 prefill 用 0,1、decode 用 2,3） |
| `--kv-transfer-config` | `kv_connector` 设为 `"MooncakeStoreConnector"`，`kv_role` 设为 `kv_producer` / `kv_consumer` / `kv_both` |

**4. 启动 proxy 服务器**：

```bash
cd vllm
python3 examples/online_serving/disagg_examples/disagg_proxy_demo.py \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --prefill localhost:8100 localhost:8101 \
    --decode localhost:8200 localhost:8201 \
    --port 8000
```

- `--model`：proxy 使用的模型与 tokenizer
- `--port`：proxy 监听端口
- `--prefill / -p`：prefill 实例的 IP 与端口列表
- `--decode / -d`：decode 实例的 IP 与端口列表

**5. 动态调整 XpYd 配比**：V1 的能力在 V0 上也有 demo 版。先用带管理密钥的调度 demo 启动：

```bash
export ADMIN_API_KEY="xxxxxxxx"

python3 examples/online_serving/disagg_examples/disagg_demo.py \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --prefill localhost:8100 localhost:8101 \
    --decode localhost:8200 localhost:8201 \
    --port 8000 \
    --scheduling round_robin
```

然后通过管理接口热添加实例：

```bash
curl -X POST "http://localhost:8000/instances/add" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{"type": "prefill", "instance": "localhost:8102"}'

curl -X POST "http://localhost:8000/instances/add" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $ADMIN_API_KEY" \
  -d '{"type": "decode", "instance": "localhost:8202"}'

# 查看 proxy 状态
curl localhost:8000/status | jq
```

> Mooncake 团队提供这个简单的 round-robin proxy 仅作演示；生产环境建议实现自定义的全局调度策略。

**6. 测试**：

```bash
curl -s http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4",
    "prompt": "San Francisco is a",
    "max_tokens": 1000
  }'
```

不在 proxy 所在机器上测试时，把 `localhost` 换成 proxy 服务器的 IP。

## 性能参考

Mooncake 官方基准显示，MooncakeStore 的 RDMA 路径在所有 XpYd 拓扑下都稳定优于 Redis 后端：例如 2P2D、tp=2 时平均 TTFT 降低约 32%。长上下文、智能体这类前缀复用率极高的负载收益更大——vLLM 团队此前在真实智能体轨迹上测得：分布式 KV 缓存池把吞吐提升 3.8 倍，P50 TTFT 与端到端延迟分别降低 46 倍与 8.6 倍，60 块 GPU 规模下缓存命中率始终高于 95%（详见 [vLLM x Mooncake Store Performance](https://kvcache-ai.github.io/Mooncake/performance/vllm/vllm-v1-mooncake-store.html)）。

## 常见问题排查

遇到连接问题，按下面的顺序检查：

1. **网络连通性**：所有节点之间能否互相访问？
2. **防火墙**：指定端口是否放行？
3. **RDMA 设备**：设备是否正确配置？
4. **mooncake_master**：是否在运行、是否可达？
5. **动态库缺失**：报 `lib*.so` 相关错误时，从源码重新编译 `mooncake-transfer-engine`。
6. **异常退出污染元数据**：vLLM 实例异常退出后重启 `mooncake_master` 清理。
7. **开调试日志**：设置 `VLLM_LOGGING_LEVEL=DEBUG` 获取详细诊断信息。

## 总结

- **定位**：`MooncakeStoreConnector` 把 KV 缓存变成所有 vLLM 实例共享的分布式存储池，支持 CPU/SSD 卸载与跨实例哈希前缀缓存，并可用 `MultiConnector` 与 `MooncakeConnector` 组合实现 XpYd 分离部署。
- **新部署**：用 vLLM V1，`mooncake_master` + `mooncake_config.json` + `--kv-transfer-config` 即可；单机扩容用 `kv_both`，分离部署用 `MultiConnector`。
- **旧环境**：vLLM V0 需要 etcd + `mooncake.json` + `mooncake_master`，记得设 `VLLM_USE_V1=0`，并注意 `mooncake-transfer-engine ≤ 0.3.3.post2` 的版本约束。
- **调优**：DP 部署固定 `PYTHONHASHSEED` 保证 block hash 一致；V0 实例异常退出后重启 master；生产环境建议自定义 proxy 调度策略。

参考：

- [KV Cache Storage & Sharing with MooncakeStore](https://kvcache-ai.github.io/Mooncake/deployment/integrations/vllm/kv-cache-storage.html)（Mooncake 官方文档）
- [vLLM Integration Performance](https://kvcache-ai.github.io/Mooncake/performance/vllm/index.html)（Mooncake 官方文档）
- [vLLM x Mooncake Store Performance](https://kvcache-ai.github.io/Mooncake/performance/vllm/vllm-v1-mooncake-store.html)（Mooncake 官方文档）
- [Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving](https://github.com/kvcache-ai/Mooncake)（GitHub）
