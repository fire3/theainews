---
title: "拆解 vLLM 分离式服务：Prefill/Decode 拆分与无 GPU 前端实战指南"
description: "vLLM 官方指南详解分离式服务：如何把 prefill 与 decode 拆成独立实例、用 KV Connector 搬运缓存，并把分词与解析下沉到无 GPU 前端。"
pubDate: 2026-10-02
author: "林晓"
category: "tutorial"
tags: ["vLLM", "分离式服务", "PD 分离", "KV 缓存", "NIXL", "推理优化", "教程"]
image: "/covers/2026-10-02-vllm-disaggregated-serving-guide.jpg"
imageAlt: "封面：手绘笔记风格，展示 prefill、decode 与无 GPU 前端三层拆分的分离式推理架构草图"
---

一个 `vllm serve` 进程同时在干三件互不相干的事：处理提示词（prefill）、逐 token 生成输出（decode），以及围绕它们的一堆 CPU 工作。这三者挤在同一块 GPU 上会互相拖累——当一条长提示词进来时，几十个正在输出的请求会同时卡顿。vLLM 团队在 9 月 29 日的官方博客中给出了一份实践指南，系统讲解如何通过<strong>分离式服务（Disaggregated Serving）</strong>把不同阶段拆开，并说明每一种拆分何时值得用、如何在 vLLM v0.30.0 及以上版本中落地。

## 一个进程，三种互不相干的工作负载

朴素启动的 `vllm serve` 会把三种负载压在同一个进程里：

- **Prefill（预填充）**：一次读完整个提示词，是计算密集型，决定首 token 延迟（TTFT）。
- **Decode（解码）**：每次只产出一个 token，瓶颈在显存带宽——GPU 读模型权重的速度决定 token 间延迟（ITL）。
- **CPU 侧工作**：聊天模板渲染、分词、反分词、推理内容解析、工具调用解析，全是纯 CPU 活儿，却跑在你按加速卡租来的机器上。

问题出在前两者共享同一块 GPU：一条长 prefill 跑起来，所有 decode 流都得等它算完。而第三类工作最安静，也最容易被忽略。

分离式服务就是对症下药：不再让一个进程包办全部。把 prefill 与 decode 拆成两个实例，只要 KV 缓存搬得够快，长提示词就不会再拖住别人的输出；再把分词与解析挪到纯 CPU 前端（`/render`、`/derender`），GPU 节点上只留下按 token ID 工作的推理引擎。

## 拆分的几个维度

vLLM 提供了多个可拆分点，而且可以组合使用。

**Prefill / Decode 拆分**：两者之间传递的是 KV 缓存——decode 发出第一个 token 前，必须拿到提示词每一个 token 的注意力 key 与 value。它体量惊人：BF16 下的 Llama-3.1-70B 每个 token 要存 320 KiB，一条 1 万 token 的提示词就要给 decode 传约 3 GB，在 400 Gb/s 线速下光传输就要约 65 ms，且全部计入 TTFT。搬运工作交给 KV Connector，通常走 RDMA。上游目前已有一打以上连接器，包括 NIXL、LMCache、Mooncake、FlexKV 与 AMD 的 MoRI-IO，另有可串联多个连接器的 MultiConnector。

**前端剥离**：`/render` 把 OpenAI 请求转成 token ID，引擎只做 token-in / token-out，`/derender` 再把输出 token ID 还原成带 content、reasoning、tool_calls 的完整响应。最后这条链路是近期才补齐的，至此往返闭环。

此外还有面向多模态的 encoder 分离，以及 MoE 模型里把 attention 与 FFN 拆开的 AFD 插件；P/D 拆分本身也已覆盖混合 SSM 模型，支持 Mamba 状态传输。

## 收益与代价

分离式服务追求的不是峰值吞吐，而是**有效吞吐（goodput）**：在请求同时满足 TTFT 与 ITL 目标的前提下，系统能稳定承载的请求速率。

它的核心收益有三点：TTFT 与 ITL 可以各自独立调优，每层用最适合该阶段的并行策略；负载上升时尾延迟保持平稳，只跑 decode 的实例永远不会被长 prefill 卡住；此外 chunked prefill 只能部分缓解干扰，且分块大小要随流量反复调参。

官方在单机两张 NVIDIA L40S（48 GB、PCIe、无 NVLink）上做了实测：Qwen2.5-7B-Instruct、约 8k token 提示词、256 输出 token、每档 100 个泊松到达请求、关闭前缀缓存。对比组是 `vllm serve --data-parallel-size 2`，两边用同样的两张 GPU。

结果显示：在 0.4–0.6 req/s 区间，两种方案的中位 ITL 相当，但合署部署的 p99 高出约六倍——从 23 ms 跳到 169 ms，2 req/s 时达到 263 ms；而 P/D 分离的 p99 始终保持在 25–52 ms 之间。

代价同样明确：第一，你要多运维三到四个服务，KV 传输成为新的故障点；第二，每个首 token 都要为传输买单。在同一台既无 NVLink 也无 GPU P2P 的测试机上，每条约 470 MB 的 KV 缓存（Qwen2.5-7B 每 token 56 KiB）传到 decode 要花约 1.3 s。即便是走主机内存中转，PCIe 4.0 也只需几十毫秒，多出来的开销主要来自拷贝周边的调度——包括 decode 只能在自己的前向步之间轮询才发现传输完成。

因此官方强调：**先验证传输，再谈基准测试。** 单机上运行 `nvidia-smi topo -p2p r` 应显示 prefill 与 decode 的 GPU 之间为 OK；然后逐条发送长提示词，查看 decode 的 KV Transfer 指标。若 Avg xfer time 高达数百毫秒，先修网络。

CPU 层的成本则很低。同一台机器上，为 Qwen2.5-7B 渲染并分词一条 9k token 的聊天提示词约耗 15 ms CPU；一台默认配置的 render 服务器用略多于一个核就能跑到 73 req/s。在合署部署尾延迟崩塌的 0.4 req/s 档位，渲染开销不到单核的 1%。

官方给出的选择建议如下：

| 你的处境 | 建议 |
|---|---|
| 生产负载下 ITL p99 达不到 SLO | 分离。这是最主要的适用场景 |
| 高并发 + 长提示词 | 分离，前提是 KV 传输够快，prefill 干扰在此最严重 |
| 上下文不断增长的聊天或智能体循环 | 分离并开启双向传输，配合 KV 卸载或共享缓存（LMCache、Mooncake） |
| GPU 节点的 CPU 占用里能看到模板/分词/解析 | 剥离 render 层 |
| TTFT 是硬约束 | 保持合署，或先测量。传输会落在每个首 token 上 |
| KV 传输很慢 | 先修传输或维持合署，它同时抬高 TTFT 并限制吞吐 |
| 低流量、突发、对延迟不敏感 | 维持合署 |

## 上手：三进程跑通 P/D

以下示例要求 vLLM v0.30.0 及以上。示例模型用 Qwen3-0.6B（加载快），但它太小，看不出 P/D 收益，真正压测需换更大的模型。

```bash
# Prefiller，跑在 GPU 0
CUDA_VISIBLE_DEVICES=0 UCX_NET_DEVICES=all VLLM_NIXL_SIDE_CHANNEL_PORT=5600 \
vllm serve Qwen/Qwen3-0.6B --port 8100 \
  --kv-transfer-config '{"kv_connector":"NixlConnector","kv_role":"kv_producer"}'

# Decoder，跑在 GPU 1
CUDA_VISIBLE_DEVICES=1 UCX_NET_DEVICES=all VLLM_NIXL_SIDE_CHANNEL_PORT=5601 \
vllm serve Qwen/Qwen3-0.6B --port 8200 \
  --kv-transfer-config '{"kv_connector":"NixlConnector","kv_role":"kv_consumer"}'

# 代理
python tests/v1/kv_connector/nixl_integration/toy_proxy_server.py --port 8192 \
  --prefiller-hosts localhost --prefiller-ports 8100 \
  --decoder-hosts localhost --decoder-ports 8200
```

代理是粘合剂：对每个请求，它先以 `max_tokens=1` 与 `kv_transfer_params: {"do_remote_decode": true}` 调用 prefill。prefill 算出 KV 缓存、持有对应 block，并返回指向这些 block 的参数；代理再把请求连同参数转发给 decode，decode 在生成前通过 NIXL 拉取 block。客户端把地址指向 8192，就像访问任何 OpenAI 端点。

三个值得早点知道的设置：`VLLM_NIXL_SIDE_CHANNEL_PORT` 在单机上必须每个 worker 唯一；`kv_lease_duration`（在 `kv_connector_extra_config` 中设置，默认 30 s）决定 prefiller 等 decode 来取 block 的时长，高负载下这是最该调的参数；`kv_load_failure_policy` 决定传输失败后的行为——默认 `fail` 会让请求报错，`recompute` 则由 decode 自己重算缺失的 KV，慢但请求能活下来。

## 多轮对话：别再重复计算

标准 P/D 只做单向传输，对聊天与智能体循环很浪费：第二轮时 decode 手里还留着刚生成内容的 KV，但 prefill 从没算过，于是 prefill 只能重算。在两个实例上都开启 `bidirectional_kv_xfer` 后，prefill 会直接从 decode 拉回这些 block，只计算新增 token。代理按客户端传来的 `conversation_id` 追踪 block 归属。

推理模型上有一条警告：decode 的 block 里包含它生成的思考轨迹。如果下一轮提示词丢掉了这些内容（如 Qwen3 的聊天模板默认所为），prefill 的提示词就与 decode 的 block 对不上，得到的将是错误输出而非仅仅变慢。目前 vLLM 不会捕获这种不一致（#43094），开启前务必核对聊天模板。

## 无 GPU 前端

把 CPU 工作移出 GPU 机器只是一半。一旦引擎改成 token 进、token 出，它就不再需要聊天模板与解析器，调用方也能直接使用 token ID：路由器可以按真实提示词 token 命中前缀缓存来挑选副本，而不是靠文本猜测；RL 与评测流水线能拿到模型真正看到和产出的 ID，这对解码文本不总能原样重新分词尤为重要。多模态预处理也会一并迁移——图像解码与模型 processor 跑在 render 层，配合 encoder 分离后，render 只把处理后的张量与元数据发出去，而处理后的载荷可能远大于源图，请求大小上限要据此调整。

两个服务即可：一个无 GPU 的 render 层，一个只认 token 的引擎。解析器放在 render 端，因为 `derender` 在那里运行。

```bash
vllm launch render Qwen/Qwen3-0.6B --port 8100 \
  --reasoning-parser qwen3 --enable-auto-tool-choice --tool-call-parser hermes
vllm serve Qwen/Qwen3-0.6B --tokens-only --port 8200
```

这两种模式默认总是暴露其横向扩展端点；普通 `vllm serve` 默认关闭。若想在同时接受普通 OpenAI 流量的服务器上启用 `/render`、`/derender` 或 `/inference/v1/generate`，需加 `--enable-scale-out`。

随后就是三跳：render → generate → derender。

```python
import httpx

MODEL = "Qwen/Qwen3-0.6B"
RENDER = "http://localhost:8100"  # vllm launch render
ENGINE = "http://localhost:8200"  # vllm serve --tokens-only

chat_request = {
    "model": MODEL,
    "messages": [{"role": "user", "content": "What is 17 * 23?"}],
    "max_tokens": 2048,
}

with httpx.Client(timeout=60.0) as client:
    # 1. 请求 -> token ID（无 GPU）
    generate_request = client.post(f"{RENDER}/v1/chat/completions/render", json=chat_request).json()
    # 2. token ID -> token ID（GPU）
    generate_response = client.post(f"{ENGINE}/inference/v1/generate", json=generate_request).json()
    # 3. token ID -> ChatCompletionResponse（无 GPU）
    response = client.post(f"{RENDER}/v1/chat/completions/derender", json={
        "model": MODEL,
        "generate_response": generate_response,
        "prompt_tokens": len(generate_request["token_ids"]),
        "chat_request": chat_request,
    }).json()

message = response["choices"][0]["message"]
print(message["reasoning"], message["content"], sep="\n---\n")
```

注意 `derender` 要回传原始的 `chat_request`：解析器需要工具定义、`tool_choice`、`include_reasoning` 等上下文，才能产出与普通 `vllm serve` 一致的三段式拆分。若模型配置了解析器却不回传，会直接得到 400，而不是静默把 `<tool_call>` 标记泄漏进正文。

两个端点也接受 `stream: true`。`/render` 会把 stream 保留在返回的请求里，于是 generate 也流式输出，每个 generate 分片单独走一次 derender。由于服务器不在调用之间保存任何状态，`stream_state` 与 `prompt_token_ids`、`chat_request` 需要随每个分片传递。

## 部署 render 层

render 层即使流式也不保存请求级状态，因此可以像无状态 Web 服务一样扩展：副本放在普通负载均衡后面，按 CPU 独立于 GPU 池扩缩容。

关键是**保持配置一致**。render、derender 与引擎必须在模型、分词器、聊天模板与解析器参数（`--chat-template`、`--default-chat-template-kwargs`、`--reasoning-parser`、`--tool-call-parser`、`--enable-auto-tool-choice`）上完全对齐。一旦不匹配不会报错，你只会得到一份与 `vllm serve` 不同的 content / reasoning / tool_calls 拆分。

接着是线程池容量。模板、分词、多模态预处理与流式解析回放都跑在 renderer 的 worker 上，由 `--renderer-num-workers` 决定，默认只有 1。普通渲染很便宜（前述 9k token 提示词约 15 ms CPU），但把推理或工具调用模型通过解析器做流式解码要贵得多，需按并发解析流数量提高 worker 数或增加副本。

## 把两种拆分组合起来

两种拆分可以同时启用：四层，但只需三台服务器——一个 `vllm launch render` 同时处理 `/render` 与 `/derender`，prefill 与 decode 各一台。目前还没有上游组件替你驱动这四跳，但各部件能组合，因为 `/inference/v1/generate` 和 `/v1/chat/completions` 一样接受 `kv_transfer_params`。你的代码需要自己扮演 render 与 derender 之间的代理角色。

## 谁在生产里跑它

- **llm-d** 使用 vLLM 原生的远程 prefill/decode 与 NIXL KV 传输能力，由 router 与 EPP 调度器选择端点并编排 KV 缓存交接。
- **NVIDIA Dynamo** 在 Kubernetes 上以聚合或分离模式运行 vLLM，自带 router 与 planner。
- **KServe** 通过基于 llm-d 的 `LLMInferenceService` 暴露该能力。
- **vLLM production stack** 用 Helm 提供分离式 prefill，AIBrix 补齐控制面。
- 连接器侧，月之暗面的 Mooncake、LMCache 与 AMD 的 MoRI-IO 都已进入上游；由于 decode 位于连接器之后，它甚至不必是 vLLM——TileRT 就用标准 vLLM prefill 搭配自家延迟优化过的 decode 引擎。

## 尚未解决的问题

带解析器的流式 derender 代价高昂。推理与工具解析器持有无法序列化的状态，每个分片都要重建全新解析器，并把 token 历史重新回放一遍。传输是每分片 O(n)，回放是每分片 O(n) 次解析调用，而 Hermes、DeepSeek-R1 这类解析器的 `parse_delta` 本身还会重扫已累积文本——长生成下相当于 O(n³) 的字符操作。对数以千计 token 的推理输出做基准测试，测得同等负载下 CPU 约为进程内方案的 9 倍，端到端 p50 增加 15%。缓存层已排期（#57571）。在它落地前，单 worker 的 render 层在并发解析流下会打满，需按前文方式扩容。

长提示词还会占满传输通道。解析器路径会在每个分片完整重发 `prompt_token_ids`：一条 10 万 token 的提示词配 1k token 输出，提示词要占每个请求体的约 99%。不带解析器的普通反分词没有这个问题。

一些小的正确性缺口仍在修复：批量 derender 解析工具调用时不一定返回 `finish_reason: "tool_calls"`（修复见 #47931），并且会自行生成工具调用 ID 而非沿用解析器的；logprobs 从无分词器引擎返回的是 `"token_id:N"` 占位字符串，可用但不理想，#57574 提议返回真正的整数 token ID。此外 #56851 在讨论：`/inference/v1/generate` 是否应直接返回文本或 derender 结果，为不需要第三跳的调用方省掉一次往返。总纲式 RFC 为 #42729（批量反分词）、#47161（流式反分词）、#22817（tokens-in/tokens-out）与 #34407（分离式前端）。

## 从哪里开始

如果你有两张 GPU，先用 7B 级模型跑一遍上面的 NIXL 示例。Qwen3-0.6B 的 prefill 太快，几乎不会干扰 decode，P/D 无从发挥。先验证传输，再在同一对 GPU 上，用同样基准对比 8192 端口上的代理与合署的 `vllm serve --data-parallel-size 2`，比较 p99 ITL、TTFT 与有效吞吐。逐步抬高 `--request-rate`，直到合署的 p99 ITL 崩掉——在测试机上配 8k 提示词，这个点是 0.4 req/s。

```bash
vllm bench serve --model Qwen/Qwen2.5-7B-Instruct --port 8192 \
  --dataset-name random --random-input-len 8192 --random-output-len 256 --ignore-eos \
  --request-rate 0.4 --num-prompts 100 \
  --percentile-metrics ttft,tpot,itl --metric-percentiles 50,99 \
  --goodput ttft:2000 tpot:30
```

如果跨档位复用同一个 `--seed`，每个服务都要加 `--no-enable-prefix-caching`，否则后续档位会重放已被缓存的提示词，缓存命中恰好掩盖了你想要测量的 prefill 干扰。

服务聊天或智能体场景时，开启 `bidirectional_kv_xfer`，并且要在第五轮而不是第一轮测 TTFT。若已经在 Kubernetes 上，直接从 llm-d 或 Dynamo 起步，不要自己造代理。如果要用流式 derender 跑推理或工具调用模型，务必先对 render 层做基准测试再定容量——这是最容易让人意外的一环。

## 核心总结

- **一个进程干三件事**：prefill 计算密集、decode 带宽密集，两者共享 GPU 会互相干扰，CPU 侧的模板与解析又占了加速卡机器的资源
- **两种主要拆分**：P/D 拆分靠 KV Connector 搬运缓存（每 token 数百 KiB 起，先验证传输速度）；前端剥离让引擎只做 token-in / token-out
- **要的是有效吞吐**：分离不能提升峰值吞吐，但能让 TTFT 与 ITL 独立调优、尾延迟在负载上升时保持平稳
- **多轮场景开双向传输**：否则每轮都要 prefill 重算历史；注意推理模型的思考轨迹会导致 block 与提示词错位
- **先测量再扩容**：用 `vllm bench serve` 对比 p99 ITL、TTFT 与 goodput；带解析器的流式 render 是当前最大的性能陷阱

参考：
- [Taking vLLM Apart: A Practical Guide to Disaggregated Serving](https://vllm.ai/blog/2026-09-29-disaggregated-serving-guide)（vLLM Blog，2026-09-29）
- [Disaggregated Prefilling](https://docs.vllm.ai/en/latest/features/disagg_prefill.html)
- [NixlConnector](https://docs.vllm.ai/en/latest/features/nixl_connector.html)
- [vLLM Renderer / Derenderer 文档](https://docs.vllm.ai/en/latest/features/renderers.html)
