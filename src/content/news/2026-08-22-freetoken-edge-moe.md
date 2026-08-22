---
title: "FreeToken：边缘原生 MoE 推理，个人电脑跑起 753B 模型"
description: "伯克利等团队开源 FreeToken：权重按实测带宽在 GPU/CPU 间动态分配，让 8GB 笔记本跑 35B 模型、单卡工作站跑 753B GLM-5.2，吞吐比现有边缘引擎高 1.5–2.3×。"
pubDate: 2026-08-22
author: "林晓"
category: "research"
tags: ["FreeToken", "MoE", "边缘推理", "本地 LLM", "GPU", "CPU-GPU 协同", "伯克利", "蚂蚁"]
topStory: true
image: "/covers/2026-08-22-freetoken-edge-moe.jpg"
imageAlt: "工程蓝图封面：FreeToken 边缘原生 MoE 推理，超大 753B 数字，个人电脑跑起万亿级参数模型"
---

前沿开源模型的权重从 35B 一路涨到 753B，能力在快速追平闭源系统，但**「谁能拿到参数」和「谁跑得起」之间仍有巨大鸿沟**。托管 API 不便宜，数据中心级 GPU 集群更贵；而 Steam 上有超过两亿台带独立显卡的消费级机器（其中约 72% 是 NVIDIA 显卡）——这批算力庞大却被严重闲置。

伯克利、MIT 等机构的研究者正是要复用它们。他们提出了 **FreeToken**，一个「边缘原生（edge-native）」的 MoE 推理系统：不再把个人电脑看成「一块小 GPU」，而是当成一个统一、可弹性伸缩的推理平台，让用户已有的机器成为前沿智能的实用载体。相关工作发表于 arXiv（2608.16157，2026-08-17），代码已开源。

## 核心亮点

FreeToken 号称支持 **20+ 个 MoE 模型**，并在横跨「8GB 笔记本 GPU 到单卡工作站」的硬件上跑真实编码/工具智能体：

| 硬件 | VRAM | 能跑的模型 | 关键成绩 |
|---|---|---|---|
| RTX 4060 笔记本 | 8 GB | Qwen3.6-35B-A3B | **39.3 tok/s**（超过 Codex 线上中位 33 tok/s）|
| RTX 5090 游戏桌面 | 32 GB | DeepSeek-V4-Flash（284B）| 交互式运行 |
| RTX PRO 6000 工作站 | 96 GB | **GLM-5.2（753B）** | 14.9 tok/s，是 llama.cpp（7.3）的 **2.0×** |

- 在 RTX 5090 上，Qwen3.6-35B-A3B 稳定跑 **77–83 tok/s**、DeepSeek-V4-Flash **22–25 tok/s**，比现有最强的边缘引擎在各工作负载上高 **1.5–2.3×**。
- 最值得一提的是**智能化负载下的稳定性**：转向 agent 工作负载后，FreeToken 的解码速率仍保持在单轮设定的 **12%** 以内，而竞品显著下滑（最受上下文影响的 KTransformers 在 W2 就已损失 31%）。
- 尾部延迟优势更明显：FreeToken 在所有负载下最差 TTFT 都低于 **44s**，而每个基线至少在某一设定里越过 **150s**——足以触发真实 agent 客户端的超时（如 OpenClaw 的 120s 空闲看门狗）。

> 图 1 是成本–能力前沿与分级硬件下的智能体解码速度：蓝色方块标记的正是 FreeToken 能服务的模型集，其前沿段恰好从 DeepSeek-V4-Flash 一路延伸到 GLM-5.2。

![图 1：FreeToken 服务的模型位于成本能力 Pareto 前沿，智能体解码速度分级](/images/blog/freetoken/fig1_cost_frontier.png)

## 为什么个人跑 MoE 这么难

MoE 天然适合边缘：每层虽然存了几百个专家，但每个 token 只路由到其中一小撮（例如 DeepSeek-V4-Flash 在 43 层里每层只激活 256 个 routed experts 中的 6 个，284B 参数单次只算其中 13B，激活足迹能塞进 32GB 显存）。但稀疏激活让「计算」可行，完整专家池却让「高效服务」变难。现有边缘引擎在此短板上退得很远，问题集中在三处：

- **Prefill 几乎摧毁了 MoE 的工作集稀疏性**。一条长 prompt 里各路路由的并集往往覆盖每层大部分专家，等于把专家工作集变成稠密的；超出显存的部分得反复从内存搬。在 agent 工作负载里尤其致命——工具调用让上下文持续变长、频繁触发 prefill。
- **Decode 是另一个极端**：每个 token 只激活稀疏一小撮专家，但缓存未命中需要反复加载/驱逐/执行专家。现有系统缺少「怎么服务这些未命中」的成体系策略：静态放置跟不上 token 级路由变化，而预测预取只能降低未命中率，无法决定不可避免的未命中该怎么在 PCIe 传输、GPU 执行和 CPU 直算之间划分。
- **边缘资源多变且不专属**。与数据中心不同，消费硬件在 GPU 容量、PCIe 带宽、内存带宽、CPU 能力上差异巨大，还经常和浏览器、游戏等应用共享，可用预算随时波动。没有哪种静态放置/调度策略能同时适配所有设备、负载阶段和运行条件。

## 设计：三大机制

FreeToken 用两层专家内存层级组织服务：**CPU 内存常驻完整专家池（事实来源）**，非专家权重常驻 GPU；GPU 剩余显存做成一个**跨所有专家层共享的弹性专家缓存**。

![图 2：FreeToken 系统总览 —— prefill 全层双缓冲与语义感知状态缓存；decode 的共享 LRU 专家缓存与 q⋆ 带宽自适应分配](/images/blog/freetoken/fig2_overview.png)

### 1. 带宽自适应执行（bandwidth-adaptive execution）

把有限的边缘带宽从「固定瓶颈」变成「运行时调度信号」：

- **Prefill**：因为几乎激活全部专家，FreeToken 不做按需取数，而是用**全层双缓冲**——GPU 算第 l 层时，专门的传输流同时把第 l+1 层的完整专家集合载入另一缓冲，让权重搬运持续在后台进行；缓冲随后互换角色。
- **Decode**：PCIe 传输和 CPU 直算都吃同一份内存带宽，所以需要更细粒度的分配。FreeToken 用 **q⋆ 策略**把每步的缓存未命中在「GPU 缓存填充」和「CPU 直算」之间按两台测得带宽划分：`q⋆ ≈ m·BP/BH`（m 为未命中专家数，BP 为固定专家传输带宽，BH 为 CPU 侧专家处理带宽）。被填充的专家进缓存并在 GPU 上算、留驻供复用；在 CPU 算的专家就地执行、不改驻留。CPU 与 GPU 各自算部分和再做**精确合并**，不引入算法近似。当 BH 接近 BP 时，q⋆ 逼近 m，系统自然退化为纯按需填充，无需单独分支。

### 2. 语义感知缓存（semantic-aware caching）

决定在稀缺内存里留什么：

- **跨智能体回合的循环状态复用**：混合注意力模型除了 KV cache 还有一重前缀资源——循环层把整个前缀压成一个持续演化的状态，无法部分复用。FreeToken 维护一个「语义感知状态缓存」：在**特殊 token 锚点**（思考段、工具调用、工具输出、对话回合）记录 recurrent 状态检查点。这些正是 agent 框架编辑/截断上下文的位置（OpenClaw 剥思考块、OpenCode 压缩旧工具输出、SWE-agent 只保留最近若干观测）。编辑后从最近的幸存锚点恢复，只重算真正新增的后缀，无需重新 prefill 数千 token。
- **解码的专家局部性**：相邻 token 常路由到重叠专家。FreeToken 用**共享 LRU 专家缓存**捕获这种跨 token 路由局部性，让大多数路由访问命中显存，只把残余未命中交给 q⋆ 策略。

### 3. 弹性边缘资源管理

- **运行时缓存重建**：因为 CPU 专家池是事实来源，GPU 显存只影响性能、不影响正确性。在调度安全点，FreeToken 可在**不重启引擎、不重载专家池**的前提下，按修订后的显存预算重建 GPU 专家缓存，把 KV cache 与专家的划分随时调优。
- **快速启动**：加载专家权重时直接读入最终的主机布局、之后才 pin 内存（避免先 pin 空缓冲再写、白白 fault-in 清零几 GB 页面）；同时免去 GPU 预热——首个请求用冷缓存服务、未命中走普通 decode 路径即可。对 FP4 的 DeepSeek-V4-Flash（约 140GB 专家池）而言，冷启动通常要数十秒。

## 实现要点

- **CUDA 图兼容的 LRU 缓存**：专家缓存的未命中、取数数量、驱逐槽位每步都在变，若由 host 控制会在每个 MoE 层引入昂贵同步。FreeToken 把所有路由相关控制**放在 GPU 上**，以「固定形状工作缓冲 + 设备驻留有效计数」的形式静态捕获进 CUDA 图：一个 kernel 一次完成去重、按驻留表分类、按带宽推出取数数、选驱逐受害者和逻辑路由 ID 改写；受害者选择用单遍 kernel 一次找出 K 个最久未用候选槽，不管实际未命中多少都只付一遍扫描。CPU 分支也被一并捕获进图，重放一次就执行完整的异构步骤，无需逐 token 的 Python 调度。
- **专家存储与平台适配**：FreeToken 用「专家 bank」统一不同 checkpoint 的布局（以 `层×专家` 标识为前导维），并提供 **FTW（FreeToken Weight）** 格式提前把权重合并进运行时 layout，加载时跳过张量发现与 repack，用并行直接 I/O 直读对齐块。若某平台无法 pin/DMA（部分 OS/驱动限制），则回退到**纯 CPU MoE 后端**——只会牺牲峰值传输带宽以换取可部署性。
- **技术底座**：融合 SGLang/vLLM 的 GPU-centric 架构（paged KV + radix 前缀复用）+ FlashInfer + Flash Linear Attention。

## 评估结果

实验主要在 RTX 5090 上跑四个真实智能体负载（AIME 数学、OpenCode/SWE 编码、Claude Code/SWE 编码、OpenClaw 邮件/日历），对比 llama.cpp、Ollama、KTransformers、MoE-Infinity，权重格式完全对齐（Qwen3.6 全用 BF16、DSV4 用原生 MXFP4 专家块 bit 级一致）。

![图 3：RTX 5090 上端到端服务 —— 上排解码 TPS、下排 Mean TTFT（对数刻度）](/images/blog/freetoken/fig3_results.png)

- **解码吞吐**：FreeToken 在 Qwen3.6 上 77–83 tok/s、DSV4-Flash 22–25 tok/s，是各负载最强基线的 **1.8–2.3× / 1.5–1.9×**；且速率在 agent 负载下几乎不掉（距单轮 W1 保持 12% 以内）。MoE-Infinity 只能服务 W1（8.8 tok/s），其预填充分级上限让长 prompt 负载直接中断。
- **首个 token 延迟（TTFT）**：均值在六个多轮单元里拿下五个最低；**尾巴**差距更悬殊——FreeToken 最差回合始终 <44s，而每个基线至少在某一处超过 150s（llama.cpp 232s、Ollama 179s、KTransformers 946s）。

**机制归因**（图 4）：全层双缓冲让 prefill 变成传输受限——有重叠时每个 8192-token 分块 1.19–1.22s 完成（即 64.4GB 专家池以 52.7GB/s 传输一遍的时间，PCIe 5.0 ×16 的实用上限），16k token 下吞吐爬到 **6.7k tok/s**；关闭双缓冲则 4k/8k/16k 分别损失 19%/25%/26%。解码局部性方面，全局 LRU 相比 KTransformers 的 prefill 更新放置（41%/59% 未命中）和 llama.cpp 的静态切分（62%/89%），把解码期专家读取未命中压到 16%/39%。

![图 4：(a)prefill 吞吐随 prompt 长度； (b)解码期专家未命中率随缓存容量](/images/blog/freetoken/fig4_breakdown.png)

**跨硬件普适性**（图 5）：在五台消费机器上 FreeToken 以 1.3×（3090/4090）、1.9×（5090 服务器）、2.1×（5090 桌面）、1.8×（4060 笔记本）领先最强基线；同一颗 5090 硅片从多通道服务器换到双通道消费桌面只损失 4% 解码速率，而 llama.cpp 因 CPU 驻留专家在双通道 DDR5 上挨饿只剩 80%。前沿档上，FreeToken 在单张 RTX PRO 6000 以 14.9 tok/s 服务 753B 的 GLM-5.2（llama.cpp 仅 7.3，2.0×），且专家权重 bit 一致、TTFT 相当；KTransformers 在此机器上根本没有可服务的路径（其 GLM-5.2 需要 753GB–1.5TB 主机驻留专家）。

![图 5：跨消费 GPU 的编码智能体解码 TPS](/images/blog/freetoken/fig5_crosshardware.png)

## 与相关工作的一步

FreeToken 的核心区别在于：**它改变的是「残余未命中怎么被服务」，而不是「未命中预测得多准」**。既有工作要么静态放置（KTransformers、llama.cpp），要么用 host 侧启发式（HybriMoE、SMoE）而无法捕获进 CUDA 图；也有工作为省带宽牺牲精度（HOBBIT 取降精度副本、SiDA/SMoE 替换或跳过低分专家）。FreeToken 保持路由计算精确、不改模型，只是把缓存、传输和 CPU 执行在一个运行时里按实测带宽模型协调起来。

## 核心总结

- **FreeToken** 是面向个人硬件的边缘原生 MoE 推理系统，把 GPU、CPU、内存与互连当作统一推理平台，支持 20+ 个 MoE 模型。
- **带宽自适应执行**：prefill 用全层双缓冲隐藏专家搬运；decode 用 `q⋆ ≈ m·BP/BH` 把未命中在 PCIe 传输与 CPU 直算间按实测带宽分配，两端部分和精确合并。
- **语义感知缓存**：在 thinking/工具调用等语义锚点保存循环状态检查点，上下文编辑后只重算后缀；共享 LRU 专家缓存捕获跨 token 路由局部性。
- **弹性资源管理**：运行时可在不重启下重建 GPU 专家缓存；已修复快速启动（直读最终布局再 pin、免预热）。
- **实测**：RTX 5090 上 Qwen3.6 77–83 tok/s、DSV4-Flash 22–25 tok/s，比现有一票边缘引擎高 **1.5–2.3×**；8GB 笔记本跑 35B 达 39.3 tok/s，单卡工作站跑 753B 的 GLM-5.2 达 14.9 tok/s（llama.cpp 的 2×）。
- **稳定性**：agent 负载下解码速率仍保持在单轮的 12% 内、最差 TTFT <44s，而基线普遍跨过 150s 触发超时。
- 代码已开源（github.com/FlashML-org/FreeToken），可下载试用（flashml.ai）。

原文：[FreeToken: Efficient Edge-Native MoE Serving with Bandwidth-Adaptive Execution](https://arxiv.org/abs/2608.16157)（Shuo Yang、Xiaoze Fan 等，arXiv:2608.16157，2026-08-17）
