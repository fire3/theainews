---
title: "Mooncake × vLLM 实战：用 MooncakeConnector 搭建 PD 分离推理"
description: "手把手部署 vLLM 与 Mooncake 的 PD 分离推理：MooncakeConnector 通过 RDMA 跨节点直传 KV 缓存，峰值带宽 142.25 GB/s，覆盖 V1 与 V0 两种后端。"
pubDate: 2026-08-03
author: "林晓"
category: "tutorial"
tags: ["Mooncake", "vLLM", "PD 分离", "RDMA", "KV 缓存", "教程"]
image: "/covers/mooncake-pd.jpg"
imageAlt: "深蓝色 PPT 风格技术封面：左侧为标题占位区域，右侧为网络节点与连接线"
---

大模型推理服务里，"首字延迟"和"吞吐"往往难以兼得。长提示词要先逐 token 计算 KV 缓存（prefill），再逐 token 生成输出（decode），两者在 GPU 上争抢算力与显存带宽。PD（Prefill-Decode）分离的做法，是把这两种阶段拆到不同的实例上，让 prefill 实例专心"算得快"、decode 实例专心"出字稳"。代价是：prefill 算好的 KV 缓存必须跨节点搬到 decode 实例，搬得越慢，延迟越高。

Mooncake 的方案是用 RDMA 把这趟搬运做到极致。本文基于 Mooncake 官方文档，从零演示如何在 vLLM 上用 `MooncakeConnector` 搭建 PD 分离推理，并给出 V1（推荐）与 V0（旧版）两套部署流程。

## 为什么需要 PD 分离

一次完整的 LLM 推理由两个计算特征完全不同的阶段组成：

- **Prefill（预填充）**：一次性处理整段提示词，计算密集、显存带宽需求相对低。提示词越长，这一步越吃算力，是 TTFT（首 token 延迟）的主要来源。
- **Decode（解码）**：逐 token 自回归生成，每步只算一个 token，但每一步都要读取前面全部 token 的 KV 缓存，因此是显存带宽密集型的"小步快跑"，对 GPU 利用率要求高。

如果把两者放在同一批实例上，长上下文请求的 prefill 会瞬间占满算力，挤压 decode 的生成节奏，导致尾延迟恶化；而 decode 阶段大量时间在等显存带宽，又浪费了 prefill 需要的算力。PD 分离把两类实例分开部署，各做各的，代价就是要把 prefill 实例产出的 KV 缓存搬到 decode 实例——这也是 Mooncake 登场的原因。

## MooncakeConnector 是什么

Mooncake 是月之暗面开源的 KVCache-centric 分离式架构，核心组件是 Transfer Engine：一个高性能、零拷贝的 KV 缓存传输库，能利用 RDMA 在 GPU 之间直接搬运数据。vLLM 通过 KV Connector 接口把 Mooncake 接进自己的调度与执行路径，这个连接器就叫 `MooncakeConnector`。

工作方式是一条典型的"生产者—消费者"链路：

```text
客户端请求
   │
   ▼
Prefill 实例 (kv_producer) ── 计算并产出 KV 缓存 ──┐
                                                   │ RDMA 跨节点直传
                                                   ▼
Proxy 服务器（路由请求、串起两段调用）          Decode 实例 (kv_consumer)
                                                   │
                                                   ▼
                                            逐 token 生成输出
```

prefill 实例（生产者）算出 KV 缓存后，通过 RDMA 直接写入 decode 实例（消费者）的显存；decode 实例无需重新计算前缀，直接从缓存开始生成。在 1P1D（1 个 prefill + 1 个 decode）配置下，Mooncake 实测峰值传输带宽达到 **142.25 GB/s**，相当于 8 条 RoCE 理论带宽（约 200 GB/s）的 71.1%。

## 选择你的 vLLM 后端

官方文档按后端分了两条部署路径，先对号入座：

| 后端 | 版本要求 | 状态 | 建议 |
|---|---|---|---|
| vLLM V1 | 最新版本 | 推荐 | 新部署一律用 V1 |
| vLLM V0 | ≤ v0.6.4.post1 | 旧版（Legacy） | 仅为既有部署保留 |

如果你是全新部署，直接用 V1；V0 路径仅用于维护已有环境。

## 前置条件

无论哪条路径，都需要先装好传输引擎与 vLLM：

```bash
pip install mooncake-transfer-engine
```

> 如果安装后遇到 `lib*.so` 缺失等问题，先 `pip3 uninstall mooncake-transfer-engine`，再按官方说明手动编译二进制文件。

vLLM 本身按[官方安装指南](https://docs.vllm.ai/en/latest/getting_started/installation.html)安装即可。硬件方面，跨节点传输需要节点间 RDMA 网络可达（例如 RoCE 网卡），这也是获得高带宽的前提。

## 使用 vLLM V1（推荐）

V1 后端下，KV 缓存的跨节点传输由 `MooncakeConnector` 直接完成，无需额外配置文件，全部通过 `--kv-transfer-config` 参数与两个环境变量控制。

### 基础部署（跨节点）

假设两个节点：prefill 节点 `192.168.0.2`、decode 节点 `192.168.0.3`，各跑一个 Qwen2.5-7B-Instruct。

**Prefill 节点（生产者）**：

```bash
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --port 8010 \
  --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_producer"}'
```

**Decode 节点（消费者）**：

```bash
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --port 8020 \
  --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}'
```

**Proxy 服务器**：客户端统一访问 proxy，由它先把请求发给 prefill（只算首 token），再把完整的生成请求转给 decode：

```bash
# 在 vllm 仓库根目录下执行
python tests/v1/kv_connector/nixl_integration/toy_proxy_server.py \
  --prefiller-host 192.168.0.2 --prefiller-port 8010 \
  --decoder-host 192.168.0.3 --decoder-port 8020
```

> 注意：目前 `MooncakeConnector` 复用 nixl_integration 里的 proxy，官方表示未来会替换为自研 proxy。

然后就可以通过 proxy 的 8000 端口发请求：

```bash
curl http://127.0.0.1:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct",
    "messages": [
      {"role": "user", "content": "Tell me a long story about artificial intelligence."}
    ]
  }'
```

### 使用张量并行

需要多卡并行时，在两侧都加上 `--tensor-parallel-size`，并配合 `CUDA_VISIBLE_DEVICES` 指定卡：

```bash
# Prefiller
CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7 \
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --port 8010 \
  --tensor-parallel-size 8 \
  --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_producer"}'

# Decoder
CUDA_VISIBLE_DEVICES=0,1,2,3,4,5,6,7 \
vllm serve Qwen/Qwen2.5-7B-Instruct \
  --port 8020 \
  --tensor-parallel-size 8 \
  --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer"}'
```

### 配置参数

`--kv-transfer-config` 是 JSON 字符串，常用字段如下：

| 参数 | 取值 | 说明 |
|---|---|---|
| `kv_connector` | `"MooncakeConnector"` | 指定 KV 传输连接器 |
| `kv_role` | `kv_producer` | prefill 实例，负责产出 KV 缓存 |
| | `kv_consumer` | decode 实例，负责消费 KV 缓存 |
| | `kv_both` | 同时具备两种能力（实验性） |
| `num_workers` | 默认 10 | 每个 prefill worker 中发送 KV 缓存的线程池大小 |

### 环境变量

V1 路径主要涉及两个环境变量：

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `VLLM_MOONCAKE_BOOTSTRAP_PORT` | 8998 | Mooncake bootstrap 服务器端口，**仅 prefill 实例需要**；同一主机上每个 vLLM worker 必须使用唯一端口，TP/DP 部署下按 `base_port + dp_rank * tp_size + tp_rank` 计算 |
| `VLLM_MOONCAKE_ABORT_REQUEST_TIMEOUT` | 480 | 请求中止后自动释放 KV 缓存的超时时间（秒），避免资源被无限期占用 |

## 使用 vLLM V0（旧版）

V0 路径面向 ≤ v0.6.4.post1 的旧部署，基于 PR 10502 与 PR 10884。配置方式与 V1 差异较大：需要一份 `mooncake.json` 描述分布式连接，并自行启动 etcd 等元数据服务。

### 安装

```bash
pip3 install mooncake-transfer-engine
```

> 版本约束：vLLM ≤ 0.8.4 需要 `mooncake-transfer-engine ≤ 0.3.3.post2`；最新版本中 `mooncake_vllm_adaptor` 接口已被弃用。

vLLM 需要从源码编译（包含 C++ 与 CUDA 代码）：

```bash
git clone git@github.com:vllm-project/vllm.git
cd vllm
pip3 uninstall vllm -y
pip3 install -e .
```

如果编译失败，先升级 cmake：`pip3 install cmake --upgrade`。

### 准备 mooncake.json

prefill 与 decode 两侧使用**同一份**配置文件。RDMA 协议版本：

```json
{
  "prefill_url": "192.168.0.137:13003",
  "decode_url": "192.168.0.139:13003",
  "metadata_server": "192.168.0.139:2379",
  "metadata_backend": "etcd",
  "protocol": "rdma",
  "device_name": "erdma_0"
}
```

字段含义：

| 字段 | 说明 |
|---|---|
| `prefill_url` | prefill 节点地址，端口用于与元数据服务器通信 |
| `decode_url` | decode 节点地址。若 prefill 与 decode 跑在同一节点，端口必须与 `prefill_url` 至少相差 50 以避免冲突 |
| `metadata_server` | 元数据服务器地址，支持 etcd、redis、http，如 `"etcd://192.168.0.137:2379"`、`"redis://192.168.0.137:6379"`、`"http://192.168.0.137:8080/metadata"` |
| `metadata_backend` | 目前支持 `etcd`、`redis`、`http`；缺省时若 `metadata_server` 无前缀，默认 `etcd`（该参数未来会被弃用） |
| `protocol` | `rdma` 或 `tcp` |
| `device_name` | `protocol` 为 `rdma` 时必填，多网卡用逗号分隔，如 `"erdma_0,erdma_1"` |

没有 RDMA 环境时，也可以改用 TCP：

```json
{
  "prefill_url": "192.168.0.137:13003",
  "decode_url": "192.168.0.139:13003",
  "metadata_server": "192.168.0.139:2379",
  "metadata_backend": "etcd",
  "protocol": "tcp",
  "device_name": ""
}
```

### 运行示例

记得把 IP 与端口替换成自己的环境。

**1. 启动 etcd 元数据服务**：

```bash
etcd --listen-client-urls http://0.0.0.0:2379 --advertise-client-urls http://localhost:2379
```

**2. Prefill 侧（生产者）**：

```bash
MOONCAKE_CONFIG_PATH=./mooncake.json VLLM_USE_MODELSCOPE=True python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --port 8100 \
    --max-model-len 10000 \
    --gpu-memory-utilization 0.8 \
    --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_producer","kv_rank":0,"kv_parallel_size":2,"kv_buffer_size":2e9}'
```

**3. Decode 侧（消费者）**：

```bash
MOONCAKE_CONFIG_PATH=./mooncake.json VLLM_USE_MODELSCOPE=True python3 -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4 \
    --port 8200 \
    --max-model-len 10000 \
    --gpu-memory-utilization 0.8 \
    --kv-transfer-config '{"kv_connector":"MooncakeConnector","kv_role":"kv_consumer","kv_rank":1,"kv_parallel_size":2,"kv_buffer_size":2e9}'
```

关键参数：

| 参数 | 说明 |
|---|---|
| `MOONCAKE_CONFIG_PATH` | `mooncake.json` 配置文件路径 |
| `VLLM_USE_MODELSCOPE` | 可选；能访问 HuggingFace 就去掉 |
| `kv_rank` | producer 为 0，consumer 为 1 |
| `kv_parallel_size` | 目前固定为 2 |
| `kv_buffer_size` | KV 缓存查找缓冲区大小；提示词越长越需要调大，OOM 时降低 `--gpu-memory-utilization` |
| `--tensor-parallel-size` | 支持；同机部署时用 `CUDA_VISIBLE_DEVICES` 区分 |

> 同机部署时，`decode_url` 必须与 `prefill_url` 端口至少相差 50（例如 `"decode_url": "192.168.0.137:13103"`）；如果两者设成相同 URL，decode 端口会被自动 +100。

**4. 启动 proxy 服务器**（新建 `proxy_server.py`，并把 IP 改成 decode 节点）：

```python
import os
import aiohttp
from quart import Quart, make_response, request

AIOHTTP_TIMEOUT = aiohttp.ClientTimeout(total=6 * 60 * 60)
app = Quart(__name__)

async def forward_request(url, data):
    async with aiohttp.ClientSession(timeout=AIOHTTP_TIMEOUT) as session:
        headers = {"Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY')}"}
        async with session.post(url=url, json=data, headers=headers) as response:
            if response.status == 200:
                async for chunk_bytes in response.content.iter_chunked(1024):
                    yield chunk_bytes

@app.route('/v1/completions', methods=['POST'])
async def handle_request():
    try:
        original_request_data = await request.get_json()
        prefill_request = original_request_data.copy()
        prefill_request['max_tokens'] = 1  # prefill only
        async for _ in forward_request('http://localhost:8100/v1/completions', prefill_request):
            continue
        generator = forward_request('http://192.168.0.139:8200/v1/completions',  # Change IP
                                    original_request_data)
        response = await make_response(generator)
        response.timeout = None
        return response
    except Exception as e:
        import sys, traceback
        exc_info = sys.exc_info()
        print("Error occurred in disagg prefill proxy server")
        print(e)
        print("".join(traceback.format_exception(*exc_info)))

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=8000)
```

**5. 测试**：

```bash
curl -s http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-7B-Instruct-GPTQ-Int4",
    "prompt": "San Francisco is a",
    "max_tokens": 1000
  }'
```

## 性能参考

Mooncake 团队在 1P1D（1 个 prefill + 1 个 decode）配置下，用 Qwen3-8B 模型、8 张 H800（81GB）节点 + 8 条 Mellanox ConnectX-7 RoCE 网络，测得了不同提示词长度下的传输表现：

| 提示词长度 | 平均 TTFT (ms) | KV 大小 | 实际传输耗时 (ms) | 实际带宽 (GB/s) | 带宽利用率 |
|---|---:|---:|---:|---:|---:|
| 128 | 46.09 | 20 MB | 0.54 | 36.53 | 18.3% |
| 256 | 48.04 | 38 MB | 0.61 | 60.78 | 30.4% |
| 512 | 59.91 | 74 MB | 0.92 | 78.73 | 39.4% |
| 1,024 | 67.29 | 146 MB | 1.50 | 95.23 | 47.6% |
| 2,048 | 85.31 | 290 MB | 2.51 | 112.88 | 56.4% |
| 4,096 | 124.42 | 578 MB | 4.75 | 119.00 | 59.5% |
| 8,192 | 212.05 | 1.13 GB | 8.84 | 127.57 | 63.8% |
| 16,384 | 387.52 | 2.25 GB | 16.43 | 137.09 | 68.5% |
| 32,768 | 749.62 | 4.50 GB | 31.65 | **142.25** | **71.1%** |

两个值得记住的结论：

- **提示词越长越划算**：短提示词时传输耗时占比低、带宽利用率也低；长提示词下 RDMA 的优势充分释放，32K token 时达到 142.25 GB/s 的峰值。
- **传输开销几乎可忽略**：32K token（4.50 GB）的 KV 缓存只花 31.65 ms 传输，仅占 TTFT（约 750 ms）的 **4.2%**。也就是说，在长上下文场景下，"搬 KV"本身不再是瓶颈，prefill 计算才是。

## 常见问题排查

遇到连接问题，按下面的顺序检查：

1. **网络连通性**：所有节点之间能否互相访问？
2. **防火墙**：指定端口是否放行？
3. **RDMA 设备**：设备是否正确配置，并已列入 `device_name`？
4. **动态库缺失**：报 `lib*.so` 相关错误时，从源码重新编译 `mooncake-transfer-engine`。
5. **开调试日志**：设置 `VLLM_LOGGING_LEVEL=DEBUG` 获取详细诊断信息。
6. **生产环境**：官方建议不要直接用 toy proxy，而应使用更健壮的代理方案。

## 总结

- **问题**：prefill 与 decode 计算特征相反、互相干扰，分离后需要跨节点搬运 KV 缓存。
- **方案**：vLLM 的 `MooncakeConnector` 通过 RDMA 在 prefill（`kv_producer`）与 decode（`kv_consumer`）之间直传 KV 缓存，峰值带宽 142.25 GB/s，32K 长上下文下传输仅占 TTFT 的 4.2%。
- **新部署**：直接使用 vLLM V1，`pip install mooncake-transfer-engine` 后只需 `--kv-transfer-config` 加一个 proxy，即可跑通。
- **旧环境**：vLLM V0 需要 `mooncake.json` + etcd + 自建 proxy，注意 `mooncake-transfer-engine ≤ 0.3.3.post2` 的版本约束。
- **调优**：多卡用张量并行；同机部署注意 bootstrap 端口与 `decode_url` 端口错开；OOM 时调小 `--gpu-memory-utilization` 或增大 `kv_buffer_size`。

参考：

- [Disaggregated Prefill-Decode with MooncakeConnector](https://kvcache-ai.github.io/Mooncake/deployment/integrations/vllm/disagg-prefill-decode.html)（Mooncake 官方文档）
- [vLLM PD Disaggregation Performance](https://kvcache-ai.github.io/Mooncake/performance/vllm/vllm-v1-pd-performance.html)（Mooncake 官方文档）
- [Mooncake: A KVCache-centric Disaggregated Architecture for LLM Serving](https://github.com/kvcache-ai/Mooncake)（GitHub）
- [vLLM Installation](https://docs.vllm.ai/en/latest/getting_started/installation.html)（vLLM 官方文档）
