---
title: "Ling-3.0-Flash 推测解码：把 Blackwell 上 Batch-1 的延迟地板压低 54%"
description: "LMSYS 联合蚂蚁用 NEXTN/DSpark 推测解码把 Ling-3.0-Flash 单请求吞吐从 288 提到 606 tok/s；受控对比下 DSpark 达 1120 tok/s、Mean TPOT 0.78ms。"
pubDate: 2026-08-22
author: "林晓"
category: "research"
tags: ["LMSYS", "SGLang", "Ling-3.0-Flash", "推测解码", "Blackwell", "推理性能", "MoE", "蚂蚁"]
topStory: true
image: "/covers/2026-08-22-ling3-flash-spec-decode.jpg"
imageAlt: "工程蓝图封面：Ling-3.0-Flash 推测解码，中央超大 606 数字与 tok/s，单请求吞吐 2.1×、Mean TPOT 降 54%"
---

Batch-1（单请求）解码的重要性越来越高。比如小米 MiMo 在 6 月发布 MiMo-V2.5-Pro UltraSpeed，宣称在万亿参数的 MoE 模型上达到 **1000 tok/s** 的解码速度。

Batch-1 让推理栈无处隐藏开销：没有 batch 可以摊薄启动成本，没有并发填补流水线气泡，算术强度也不足以让巧妙的 tiling 物有所值。关键路径上的每一微秒，都是用户等待的一微秒。

这篇文章讲的是如何在 **4 张 NVIDIA Blackwell GPU** 上把 Ling-3.0-Flash（一个混合线性注意力 MoE 模型）的这种延迟地板压低。它覆盖两条推测解码路径：在 **NEXTN/MTP** 路径上，团队把单请求解码从 **288 tok/s 提到 606 tok/s**，Mean TPOT 从 **3.33ms 降到 1.53ms**。第二条路径是 **DSpark**——构建在同一套栈之上的、基于置信度调度的推测解码器：一次 1000 请求的测试跑到 **1120 tok/s**、Mean TPOT **0.78ms**、接受长度 **9.95**。最后这个对比才是受控的：NEXTN 和 DSpark 用同一条命令、同一台机器测得，Mean TPOT 低了 **1.9×**（1.53ms 对 0.78ms）。本文其余部分讲的就是这些时间花在了哪里、又花了什么代价拿回来的。

## 核心结果

- **最终结果**：Mean TPOT 下降 **54%**（3.33ms → 1.53ms），单请求吞吐提升 **2.1×**（288 → 606 tok/s）。受控的 1000 请求对比中，DSpark 达到 **0.78ms** Mean TPOT 与 **1120 tok/s**。
- **优化主线**：先是 host 提前运行（run-ahead），再是 PDL 链式连接，然后是内核优化，最后是 DSpark。移除每步一次的主机端 pin，让准备工作藏到 GPU 工作背后；PDL 再把 MoE、router、KDA 与 all-reduce 路径串起来；两个融合、一次 KDA 重调、以及 bf16 的 router/lm_head GEMM 进一步缩短了剩余的 GPU 关键路径。
- **把数值精度当成带宽旋钮**：把 router gate 和 lm_head 从 fp32 降到 bf16，是结构之后最大的单点改动，约值 **+10%**。
- **全程的测量纪律**：任何主机端结论前先做「有无 profiler 标定」、冷权重微基准、以及用 Mean TPOT 而非单窗口峰值做 A/B 决策。
- **DSpark 提高每步 verify 提交的 token 数**：接受长度 9.95、并发 1 下 1120 tok/s、Mean TPOT 0.78ms——对同一 1000 请求基准，比 NEXTN 的 Mean TPOT 低 1.9×。

![四套配置的头条结果](/images/blog/ling3-flash-batch1/00_headline.png)

| 指标（8192 输入 / 1024 输出，单并发，greedy，TP4 bf16）| 初始基线 | draft-extend 图修复后 | NEXTN 调优后 | DSpark |
|---|---:|---:|---:|---:|
| Mean 输出吞吐 | 288 tok/s | 526 tok/s | 606 tok/s | **1120 tok/s** |
| Mean TPOT | 3.33 ms | 1.76 ms | 1.53 ms | **0.78 ms** |
| Median TPOT | — | — | 1.56 ms | **0.51 ms** |
| Peak 输出吞吐 | — | — | 1099 tok/s | **1945 tok/s** |
| 接受长度 Accept length | 3.14 | 3.13 | 3.25 | **9.95** |

同一套栈在 GSM8K 上的得分：准确率 0.889、无效 0.000、延迟 341.5s、输出吞吐 511.1 tok/s。

所有运行都用 Ling-3.0-Flash、4 张 Blackwell、TP4、bf16、并发 1、greedy 解码，以及同一份固定的 8192 输入 / 1024 输出随机工作负载。从左到右依次是：初始 NEXTN 基线、修好 draft-extend 图后的 NEXTN、最终调优的 NEXTN、以及 DSpark。前两列是较短的 campaign 检查点；后两列才是受控对比，各自在同一台机器上跑相同的 1000 个请求测得。Peak 吞吐只在后两列之间做比较，因为它是固定一秒钟窗口内的最大值。

这里有两个定义很关键，它们合起来解释了为什么即使在并发 1 下，输出吞吐也不是 Mean TPOT 的简单倒数：SGLang 的 TPOT **不含 TTFT**，而输出吞吐是用「总输出 token 数 ÷ 基准总墙钟时间」得到的。本文所有头条基准都使用合成的 `random` 工作负载；特别地，接受长度依赖 prompt 与输出分布，所以 9.95 是这个工作负载的接受长度，而非模型的。

## 模型

![Ling-3.0-Flash 架构](/images/blog/ling3-flash-batch1/01_model_architecture.png)

Ling-3.0-flash 是一个混合注意力 MoE 模型（`BailingMoeV3`），下文大部分内容都来自「混合（hybrid）」这个词。

| 属性 | 值 |
|---|---|
| 层 | 共 42 层：35 层 KDA 线性注意力 + 7 层 MLA 全注意力 |
| MoE | 512 个 routed experts + 1 个 shared，top-8（+1），`moe_intermediate_size` 768 |
| 隐藏大小 | 2560 |
| 词表 | 约 157k，通过 vocab-parallel lm_head 提供 |
| 权重 | bf16 下每 rank 约 63 GB |
| 部署 | 4 张 NVIDIA Blackwell，TP4，bf16，NEXTN 推测解码 |

六个注意力层里有五个是 KDA。这就是为什么最终 profile 里 MLA 注意力在 8k 上下文下每步只花 **244 µs**，也是为什么这个模型首先就很适合做 batch-1 目标：注意力又便宜、batch 又小，关键路径上剩下的就是**权重带宽和启动延迟**——正是这篇文章讨论的领域。

## batch-1 一步的形状

我们用 NEXTN 推测解码、`steps=5, topk=1, draft_tokens=6` 来解码。一个解码步是三个 CUDA 图组成的接力。

![每步三个图](/images/blog/ling3-flash-batch1/02_three_graph_relay.png)

draft 模型提出一条 6-token 链，target 模型在同一次前向里给全部六个打分，extend 图再用 target 的真实隐藏状态重放被接受的 prefix，产出下一轮的 seed。裁决本身（`eagle_sample`）发生在 verify 图内部；host 会晚一步才知道接受了几个 token。

draft 是一个单层 NEXTN 模型、自回归地跑：五步但只有四次前向，因为第一个候选来自上一轮的 seed，第五个从第四次前向的 top-k 读出。Verify 是对整条链的六个位置做一次完整的 42 层 target 前向。Extend 修正 draft 的 KV 缓存（它只见过 draft 自己的猜测），并把下一轮的 seed 交回去。

在三个图之间跨 CPU 传递的东西是**零**。固定形状加 padding 让每个依赖 accept 的计数都变成 GPU 索引而不是 host 值；持久 buffer 让生产者图直接写进消费者 buffer；真正需要在 CPU 上看到值的决策（EOS、停止串、detokenize）走侧流 D2H 和一个晚一步消费的 `copy_done` 事件。下面的一切都建立在这个性质之上。

## 两种空闲时间

一开始，GPU 每一步约有三分之二的时间是忙的。Batch-1 的空闲时间分两种，需要分开诊断，因为修法毫无共同之处：

- **Host 模式空闲**：每步三次图重放、里面执行几百个 kernel 节点、还有图与图之间接缝里的 Python 粘合代码。（是三次重放而不是三次前向：draft 图捕获的 body 里装着全部四次 draft 前向，所以自回归的 draft 循环只花一次重放。）如果 host 的每步循环比 GPU 的一步还慢，GPU 就会挨饿。修法是隐藏并缩小 host 的工作。
- **GPU 模式空闲与 GPU 模式开销**：把 host 藏起来之后，剩下的就是权重带宽（每个 MoE 层每步要冷读约 **94 MB** 已激活 expert 的权重）加几百个小型 kernel 节点固有的延迟地板。Batch 为 1 时两者都无法摊薄。修法是数据类型、融合和启动依赖调度。

![两种空闲形态](/images/blog/ling3-flash-batch1/03_two_idle_modes.png)

这两种空闲描述的是 TPOT 的「每步时间」这一侧。另一个杠杆是每步提交多少个 token：**Mean TPOT ≈ 步时间 ÷ 平均接受长度**。文章后续就沿着这些杠杆展开：host run-ahead 和接缝处理移除 host 模式空闲；PDL、dtype 改动、融合和重调缩短 GPU 关键路径；推测调参与 DSpark 提高每个 target 步提交的 token 数。DSpark 之后会在一个阻塞式 D2H 读重新引入 host pin 时，再回过来处理第一类问题。

## 先修尺子，再修机器

测量设置有三个性质决定了下文的每个数字。

<strong>Profiler 会放大 host 侧事件。</strong>CUPTI 会给它记录的每个 host 事件加开销。同一配置下，被 profile 的一步测出 5.2ms，而真实的一步（从无 profile 运行里用 TPOT×接受长度反推）是 4.9ms。这 0.3ms 的差距和我们想推理的 host 侧效应同量级，所以一条被 profile 的 trace 可能显示出实际上并不存在的跨 rank 等待。GPU kernel 时长来自硬件时间戳、比 host 侧计时更可信，但也并非免疫：trace 仍会扰动启动时序、并发、缓存状态和 CUDA 图执行。所以这里每一条 host 侧结论都先做了「有无 profiler 的标定」。

<strong>微基准对冷权重 kernel 跑得过于乐观。</strong>一个循环反复调用某个 kernel，会让它那 2.6MB 的 gate 权重常驻在 L2；而真实模型会在前后两次调用同一层之间，用约 94MB 的 expert 流量把 L2 冲掉。热态 7µs，冷态 11µs——足以翻转与库 GEMV 的相对排序。

<strong>Peak 吞吐是单窗口统计。</strong>基准的 peak 数是固定 1 秒网格上的最大值，所以带有约 ±5% 的相位带：TTFT/TPOT 平移会重新切片网格，一个把 Mean 吞吐提升 2.3% 的改动可能打印成从 909 掉到 858。两者在固定 seed 下都能精确复现，所以可复现性并不能把信号和相位分开。这里的 A/B 决策用 **Mean TPOT × 平均接受长度**。这个乘积是对步时间的一种派生估计而非实测，但它在多次运行间稳定、且对这些运行里的 accept-length 漂移不敏感，正是 A/B 判据需要的。团队报告 peak，但从不针对它调优。

正确性有独立关卡，每个改动留下来之前都要过：256-token greedy 生成的**字节级精确**对比、接受长度变化在 0.05 以内、以及在交错 temperature 采样的请求之后重跑一次 greedy 以捕捉状态污染。那些合理地改变了舍入的改动（bf16 gate、单次舍入的 combine）在 commit message 里写明，并在接受长度与任务指标上验证，而非字节一致性。

## 让 host 提前运行

这是整场 campaign 赖以立足的结构性改动，也是一个 host 模式空闲的修复。

![从锁步到深度流水线](/images/blog/ling3-flash-batch1/04_host_run_ahead.png)

`cudaGraphLaunch` 一直是异步的，GPU 上的 draft → verify → extend 顺序也是免费的：同一条 stream、FIFO。所以问题从来不是 verify 是否等 draft，而是 host 是否**每一步都被 pin 到 GPU 进度上**。

答案是：曾经是的。在 spec-v2 下，scheduler 不知道接受长度，所以 `FutureMap.resolve_seq_lens_cpu()` 会在构建下一个 batch 时把 `new_seq_lens` 从 GPU 拉回来：gate 在一个 publish 事件上、在一条私有 stream 上复制、然后 `synchronize()`。Host 等的不是一次微秒级复制，而是**上一个 verify 图执行完**。中位成本：每步 **485 µs**，而且 run-ahead 深度每一步都被重置为 0。

罪魁祸首是 `needs_cpu_seq_lens` 标志，它被 spec-v2 涉及的每个 backend 用 OR 折叠起来。`trtllm_mla` 在三种角色里都声明 `False`；同族线性注意力 backend `GDNAttnBackend` 和 `Mamba2AttnBackend` 都显式声明 `False`。而 `KDAAttnBackend` 从未声明它，于是继承了基类默认值 `True`，尽管它和两个兄弟跑的是同一份基类元数据代码。

声明 `needs_cpu_seq_lens = False` 折叠了 OR 并移除了每步同步。正确性论证是点对点的：KDA 的元数据从不读 CPU 镜像，重放 padding 来自 `forward_batch.num_padding`。

host 怎么敢在不知道 step k 接受了什么的情况下就启动 step k+1？因为这些值从不碰 CPU。`FutureMap` 是 GPU 上的中转站：step k 的图把输出 token、`new_seq_lens`、top-k 概率和隐藏状态写进按 `req_pool_idx` 索引的设备 buffer，step k+1 的图按同一索引读它们。Host 只处理索引——而索引它早就知道了。

![run-ahead 余量在哪](/images/blog/ling3-flash-batch1/05_run_ahead_slack.png)

Run-ahead 也改变了 host 成本的结构。不再每个 rank 每步都直接付它的 host 时间，只有耗尽其队列余量的那个 rank 才付。在某次四 rank 的 trace 里，恰有一个 rank 处于这种状态：它的 scheduler 段比兄弟姐妹长 5–10×，draft 图晚启动 40–80µs，draft→verify 接缝比其余中位数高 165µs，还出现带 GC 特征的周期性 400–750µs 尖峰。另外三个 rank 在每次 rendezvous 都自旋等它。可推广的诊断是：**一个 kernel 的时长不是它的工作**。一个 20KB 的 embedding all-reduce 显示 150–480µs，不是它慢，而是在吸收 skew——只有跨 rank 的时间对齐能告诉你到底哪个 rank 晚了。

## 修补接缝

锁步 pin 消失后，图与图之间的接缝就值得缩小了。在一次 CUDA 图重放前，需要把针对这一步的注意力元数据（kv 索引、block table、mamba state slot）从活着的 `req_to_token` 和 `seq_lens` 重建到图捕获的静态 buffer 里。这个 refill 每步都 eager 地跑一次，占据了接缝的大部分。在 batch-1 下它纯粹是 host 绑定的：每个 op 派发 5–15µs、执行 1–4µs。

团队在两个层面下手。第一，融合索引链：`assign_extend_cache_locs_uniform` 在 kernel 内部计算结束偏移（均匀的 `draft_token_num` 展开让跨行前缀和变得不必要），`_fused_state_indices_kernel` 把一次 gather、一次 translate、一次 padding-sentinel 写入和一次 `copy_` 并进一个 launch，同时小心保留两个副作用——包括在 padded 行上把 `req_pool_indices` 清零，这个函数内部没人需要它，但图里其他被捕获的 kernel 依赖它做越界 gather 保护。

第二，把 refill 本身捕获成一个按 `(bs, forward_mode)` 键控的小 CUDA 图。这之所以可行，靠的是重放契约早已保证的指针稳定性：重放的 `ForwardBatch` 视图只把 runner 静态 buffer 和 pool 中张量交给 backend，所以整个 prep 序列地址固定。它有四层安全机制：两次 eager 预热（让 Triton JIT 和 autotune 在捕获之外发生）、每次重放前恢复各 backend 的 `forward_metadata` 对象快照（图重放设备 op、快照恢复 Python 指针）、捕获失败时带警告的永久 eager 回退、以及对 padding、TBO、pdmux 和 LoRA 的护栏。它由 `SGLANG_ENABLE_METADATA_GLUE_GRAPH` 开关可选启用，并对 DFLASH 族推测强制关闭——因为那条路径每步都在 host 上重建注意力计划，捕获 refill 会把计划在捕获时冻结。

可捕获有硬边界。判据是：由纯设备 kernel 写持久 buffer 组成的 refill 可捕获；任何走 FlashInfer 式 `plan()` 的都不行。draft 侧就不合格：多步 draft backend 会重新 `plan()` 主 EAGLE 图已经捕获的 wrapper，把那次 re-plan 录进二级图会在重放时破坏 wrapper 的内部状态。另一个相关要求是捕获必须幂等。`trtllm_mla` 的 `_init_cuda_graph_metadata` 以前每次调用都分配新张量并替换 `decode_cuda_graph_metadata[bs]` 条目，导致第二次捕获后早前的图读到已释放内存。

## PDL：把若干小 kernel 的延迟地板叠起来

一个 batch-1 步在很短窗口里执行几百个 kernel 节点。在这个规模下，启动和 prologue 的成本和计算差不多。**Programmatic Dependent Launch（PDL）** 允许消费 kernel 在生产者仍在运行时就被调度到 SM 上：消费者先执行所有不依赖生产者输出的部分，只在依赖读取前 `gdc_wait()` 栅栏一下。

![router 路径上的 PDL](/images/blog/ling3-flash-batch1/06_pdl_router.png)

团队接了三链条：MoE 主链（`moe_align` → up-GEMM → activation → down-GEMM → combine → all-reduce）、router 链（norm → gate matvec → top-k）、和 KDA 链（`conv1d_update` → recurrent delta-rule → gated norm）。两个设计点很关键。

<strong>生产者无关的加载放在 wait 之前。</strong>这就是上图全部的门道，也是让 PDL 不只是「针对延迟受限 kernel 的启动开销消除」的原因。

<strong>Inductor 生成的 kernel 承载不了 PDL 属性。</strong>小 M 的 MoE combine 是一个 `torch.compile` 生成的 kernel；要入链就得把它换成仓库里的 Triton reduction 加 GDC。这有个数值副作用：fp32 的 `sum × scale` 只做一次最终 cast，而旧路径会舍入两次。结果略更精确、但不再 bit 相等——commit message 里写明。

后来依据 PTX `griddepcontrol` 的一个发现升级了语义：`launch_dependents` 只释放依赖者的**启动**，而消费者的 `wait` 总是栅栏在生产者 grid 完全结束后。把触发器从生产者末尾移到生产者自己的 wait 之后紧接处，能让消费者 prologue 与生产者 body 的重叠超过仅仅尾巴，前提是：消费者仍要在提前启动与每次读取生产者输出之间自己保留 `gdc_wait()`。这是每个消费者各自的属性、不是普遍保证，所以逐 kernel 检查并转换了六个。提前触发买到的东西也不确定：驱动可能提前启动一个依赖 grid，重叠多少取决于当时的调度和资源压力。`fused_moe` 用 `M ≤ 512` 检查门控它：prefill 形状下提前释放大消费者 grid 会从生产者偷走 SM，而 decode 形状下则是纯收益。

PDL 是纯调度语义。累计顺序不变的改动保持 bit 级一致；gate matvec 通过了 4-of-4 的 GDC 开/关 bit 对比。

## 两个融合加一次重调

<strong>`moe_align`，pair 轴。</strong>Triton fused-MoE GEMM 按 `block_size` 瓦片消费 token，每行共享一个 expert，`moe_align_block_size` 构建这个置换。通用路径需要两次 kernel 启动：每个 expert 的偏移定稿前、任何 token 都无法放置，这些偏移来自一次 grid 级扫描，而设备级 barrier 只存在于 kernel 边界。单 launch 变体存在，但它把 per-thread 的 expert 计数器暂存在 shared memory，因此限于 64 个 expert 以下；513-expert 的 decode 总是付两次启动。

替代方案在 pair 轴上工作：一次 [NP, NP] 的两两比较，给每个 (token, slot) 对在其 bucket 内一个稳定的秩、以及 bucket 人口，一次完成；每个 bucket 的 rank-0 代表再推导出 padded counts、bucket 有序的排他偏移、发布的 total 和 per-block expert id。没有任何量随 expert 数扩展，所以 expert 数限制消失。显而易见的替代——在 padded expert 轴上做直方图和 cumsum（最多 1024 个 bucket）——是对的，但会把约 3× 的单 SM 工作量放到关键路径上，比它替换的两个 kernel 还多。这正是让 pair 轴在此承担压力所在的原因。

两处对参考实现的有意偏离都从消费者不变量出发论证：bucket 内顺序按 pair 索引稳定而非原子调度顺序（每个 pair 写自己的输出行，所以消费者顺序无关），以及超出已发布 total 的 buffer 尾部保持未写（消费者 CTA 在读它之前就提前退出）。一个悬崖：pairwise 张量是 O(NP²)。在 NP=64 时它们完全活在寄存器里（约 4µs，与 CUDA 双 kernel 路径相当），到 NP=256 时溢写到 local memory，每次 launch 约 230µs。派发闸门是硬性的 `numel ≤ 64`；更大的 batch 回退到 CUDA 路径。

<strong>up-GEMM 尾声里的 SwiGLU。</strong>把 `silu(gate) * up` 折进 MoE up-GEMM 的尾声，每个 MoE 层省掉一个独立的 activation kernel，以及整个中间 buffer 的写后读。版式技巧是在权重加载时对 `w13` 做 per-expert 行交错，让 gate 和 up 落在同一输出瓦片的相邻偶/奇列。因为每个 GEMM 输出列是独立的点积，交错在 bit 级是中性的。

细心全花在 bit 对齐上。被替换的 kernel 用 `-use_fast_math` 编译，所以尾声逐指令复现它：`__expf` 用 `mul` + `ex2.approx.ftz`、`div.approx.ftz`、以及乘积后一次最终舍入。微妙之处：FlashInfer 在 `float` 里实例化 activation functor，所以 silu 在乘法前从不落进 bf16。在那里舍入会双重舍入、得到错误结果。

## bf16 的 router gate 与 lm_head

结构改动之后最大的一处是 dtype 改动。在 batch-1 下，router gate 和 lm_head 是纯带宽：每个解码步冷读每个 MoE 层的 gate 权重（bf16 下 2.6MB）以及 vocab-parallel 的 lm_head 投影，而两者都没有算术可以去隐藏这个读取。两者从 fp32 跑到 bf16，正好减半这些字节；端到端约值 **+10 %**，是 host run-ahead 修复之后任何单一改动里最大的增益。和上面其他舍入改动一样，这一点在 commit message 里写明，并在接受长度与任务指标上验证，而非 bit 一致性。

## KDA 在推测下的处理

一个被拒绝的推测 token 会给 KV 缓存留下一个无害的过期条目，但已经**原地污染了一个 recurrent 状态**。线性注意力和推测解码并不是免费共存的。

让它们共存的方案：verify 期间，recurrence 以状态更新禁用运行，把每个链位置的后状态写进一个中间 buffer；裁决后，`commit_mamba_states_after_verify` 把属于最后被接受位置的状态复制进持久 slot。**先暂存，再提交**。这也是紧凑 spec cache 被限制在 `topk=1` 的原因：链时接受前缀唯一、状态可按位置索引；树时接受路径是众多路径之一、状态得按树路径索引。

Profile 显示 KDA 解码是带宽受限的，主要是 K×V 状态上的 HBM 流量，所以在融合和瓦片重调之后，这里没剩多少可做。团队没有与 Blackwell 峰值对比实测带宽，所以请把这当作形态观察而非 roofline 结果。

## batch-1 下推测的经济学

权重带宽主导有一个反直觉推论：**多 verify 几个 token 几乎是免费的**。verify 4 个 token 和 6 个 token 读的是完全相同的权重。在 batch-1 加深推测，每个增加的 step 只花一次便宜的额外 draft 前向（draft 是单层）加 KDA 链 verify recurrence 里递增的串行开销，却换来接受长度。

团队扫参数而不是拍脑袋（这次扫描早于融合包，最优随后移动了，下文会注明）：

| steps / draft tokens | 接受长度 | Mean TPOT | 步时间（派生）| 稳态 tok/s |
|---|---:|---:|---:|---:|
| 3 / 4 | 3.11 | 1.51 ms | 4.70 ms | 662 |
| **4 / 5** | **3.37** | **1.45 ms** | **4.89 ms** | **690** |
| 5 / 6 | 3.45 | 1.55 ms | 5.35 ms | 645 |

步时间列是 TPOT×接受长度，是派生估计而非直接测量。每个新增 step 约花步时间的 4–9%，而边际 accept 增益几何衰减（d5→d6 只加 0.08）。盈亏平衡条件大致是 `Δaccept > 0.05 × accept`。最优也在移动：融合包落地、步时间下降后，`(5, 6)` 成了更好配置；一旦 fp8 权重进一步压缩固定基底，还需要再扫一次。

## DSpark：高质量的块起草

调节 NEXTN 的深度，是在一个固定形状算法上的一维旋钮。更大的杠杆是改算法，campaign 的后半段就是把 DSpark 搬到同一个 target 上、并给它同样的 batch-1 待遇。

DSpark 算法本身是公开的。这里的工作是把那份公开配方适配到 Ling-3.0-flash、长上下文在线蒸馏、以及 batch-1 的 Blackwell serving 栈。团队的适配在四个方面不同。

<strong>分布对齐的数据。</strong>主要用 Ling-3.0-flash 的后训练数据做蒸馏，所以 draft 训练在 serving 时会面对的分布上。蒸馏期间还用多种采样设置来提高轨迹多样性和推测解码下的鲁棒性。

<strong>消融驱动的 draft 设计。</strong>不直接继承 Ling-3.0-flash 架构，而是对关键 draft 选择做系统消融，包括是否复用 Ling-3 的注意力结构、用哪种 RoPE 变体（部分还是交错）。留下接受长度/延迟权衡最好的设计。

<strong>与 serving 耦联的在线训练系统。</strong>为长上下文和大规模在线训练构建了 **SplitServe Trainer**，一个单节点 8-GPU 框架，把资源在训练和 SGLang 推理之间对半分。训练期间，推理侧跑 target 前向为 draft 产生监督信号（如 target 隐藏状态）。这让「生成-训练」循环保持本地、削减 IO 开销、并提升长上下文工作负载的训练效率。

![SplitServe Trainer 布局](/images/blog/ling3-flash-batch1/07_splitserve_trainer.jpg)

<strong>接受感知的优化。</strong>在公开 DSpark 损失之上，加了一个与接受长度相关的 loss，让 draft 不只训练 token 级和对齐中间目标，还训练在 target verify 下更长的接受前缀。

![接受感知优化](/images/blog/ling3-flash-batch1/08_acceptance_optimization.jpg)

## 47% 空闲，与它背后的机制

DSpark 在 Blackwell TP4、batch-1 上的第一条 trace，在 239 次稳态解码迭代上，远未达到 NEXTN 路径达到的状态。中位步时间是 **10.62ms**、其中 **4.99ms** 是 GPU 空闲（**47%**）。

空闲不在 CUDA 图内部：图内微间隙在 3 秒里总计约 80ms。它全在图与图之间 eager 段里，表现为每步四五个 100µs 到 2ms 的中等间隙。

两套 FlashInfer `plan()` 实现——fa2 的 `BatchPrefillWithPagedKVCacheWrapper` 和 MLA wrapper——被喂了设备张量，而内部对 `qo_indptr`、`kv_indptr`、`kv_len_arr` 各做一次阻塞式 `.to("cpu")`。一次阻塞 D2H 会等 stream 上所有在途的东西，包括仍在执行的 draft 图。所以每步，CPU 都在 draft 启动后立刻被 pin 到 GPU 进度上；那约 1ms 的 `cudaGraphLaunch` CPU 成本没有可藏的 GPU 忙窗口；scheduler 尾部在这两者之后串行化。

结构上这又是 `resolve_seq_lens_cpu` 那个 pin：一次对设备驻留值的 host 侧阻塞读，在一个不相关的子系统里，把 run-ahead 每一步重置为 0。它给出的规则：在 batch-1，先去找 host 路径上对设备值的阻塞读，因为每一条都把整个 host 循环从隐藏工作变成一个 GPU 气泡。

## Host 供应的计划

那三个数组从来不需要来自设备。DFLASH 族保证 verify 和 draft 的 `ForwardBatch` 携带 `seq_lens_cpu = prefix + draft_token_num`（在三个独立调用点断言），且它恰好等于设备侧路径算出的 kv 长度。Host 本来就该知道它停下来读回的那个答案。

- **fa2 侧**：捕获时按 per-batch-size 在 target-verify wrapper 上安装 `fast_prefill_plan`，用 DFLASH verify 输入类型门控，让 EAGLE 的 target-verify 不受影响，外加一个「无自定义 mask」断言（fast plan 不支持 mask；DFLASH 也从不有）。

- **MLA 侧**：用纯 host 算术从 `seq_lens_cpu` 构建 plan kwargs、零 D2H，通过新的 `kv_indices_buf` 参数把 `kv_indices` 直接写进 wrapper 的 CUDA-graph buffer，再调用 `fast_mla_decode_plan(causal=True)`，跳过三次阻塞 D2H 和四次设备 buffer 刷新。捕获仍然跑真正的 `plan()`，那正是填充缓存模块和 wrapper buffer 的地方。

另外两处修复不需要额外工作。`graph.replay()` 从来是纯入队；除了挡在中间的那个 D2H，没有东西阻止 CPU 把 draft 图 → verify prep → verify 图背靠背地排队。移除它之后，verify 元数据 prep 和两次图 launch 都在 draft 图仍在执行时入队，两个图在 GPU 上背靠背跑。

## 结果

每个环境标志在合并前都先单独 A/B：

| 标志（单独测量）| 接受长度 | Mean TPOT | 判定 |
|---|---:|---:|---|
| none（overlap 开、radix cache 关）| 4.49 | 1.48 ms | 干净基线 |
| `SGLANG_OPT_FUSED_KDA_VERIFY=1` | 4.68 | 1.34 ms | 安全，保留 |

固定推测配置下的标志级轨迹，全部 8192 输入 / 1024 输出、并发 1：同步调度 1.67ms → 关 radix cache 的 overlap 调度 1.48ms（scheduler 尾部的空闲窗口从 1118µs 塌到 85µs）→ 融合 KDA verify 1.34ms。

实际部署配置在并发 1 下测 1000 个请求：accept 9.95、Mean TPOT **0.78ms**、Median TPOT **0.51ms**、输出吞吐 **1120 tok/s**、peak **1945 tok/s**。9.95 接受长度是用 block_size 16 的 DSpark draft 测的；发布的 draft checkpoint 用 block_size 8。DSpark 不吃 speculative-num-steps / draft-tokens 标志；那是 NEXTN 专属。

用 Median TPOT 乘平均接受长度得 0.51×9.95≈5.1ms，接近之前 trace 测的步时间（KDA 融合前总计约 5.3ms）。只把这当粗略一致性检验：它把中位数和平均数混在一起，对这个分布它并不是中位步时间。直接从 trace 测步时间才是闭合它的方法，而 DSpark 配置还没做这一步。trace 真正支持的是一条定性结论：host 又让开了，剩下的都在 GPU 上。

## 时间现在都去哪了

![campaign 之后的一次 NEXTN 解码步](/images/blog/ling3-flash-batch1/09_final_step_breakdown.png)

MoE grouped GEMM 1215µs、router/activation/glue 小 kernel 1127µs、all-reduce 951µs、dense GEMM 918µs、KDA 488µs、MLA 注意力在 8k 上下文 244µs，外加 400µs 残留空闲。Host 已完全隐藏；剩下的是 GPU 工作，而权重带宽主导着它。

这份普查是 NEXTN 配置；DSpark 会重新分布这一步（更宽的 verify 窗口、第二个 draft 模型图），但不改变结论。

MLA 在 8k 上下文是 244µs。长上下文在这里不是问题，这是混合架构的后果。MoE 加 dense GEMM 约 2.1ms，几乎全是权重带宽。

所以路线图很短：

- **fp8 权重是剩下的大杠杆**。把 2.1ms 带宽受限工作上的字节减半，是结构性的 15–20%，远在指标噪声带之外。接受长度补救已存在（bf16 draft），block 量化的 TP 约束也已知：`moe_intermediate_size = 768`、block 128 时，TP4 不可行；需要 `--ep-size 4`。
- **Router 融合已到合理终点**。把 gate matvec 折进 top-k kernel 会把并行度从 129×M CTA 塌到 M/BLOCK_M。PDL 链式连接是这条路正确的停靠点。
- **Host 环境工程**。对 scheduler 进程做核心绑定和 GC 调优，这其实是一种守住 run-ahead 余量的方式，而非 kernel 优化。

## 复现

NEXTN 配置：

```bash
SGLANG_ENABLE_METADATA_GLUE_GRAPH=1 \
SGLANG_OPT_FUSED_KDA_VERIFY=1 \
SGLANG_ENABLE_FUSED_VERIFY_EXTEND_GRAPH=1 \
python3 -m sglang.launch_server \
  --model-path inclusionAI/Ling-3.0-flash \
  --tp-size 4 --trust-remote-code \
  --speculative-algorithm NEXTN \
  --speculative-num-steps 5 \
  --speculative-eagle-topk 1 \
  --speculative-num-draft-tokens 6 \
  --attention-backend trtllm_mla \
  --flashinfer-allreduce-fusion-backend auto \
  --mem-fraction-static 0.85
```

DSpark 配置则把推测标志换成 DSpark draft checkpoint：

```bash
SGLANG_OPT_FUSED_KDA_VERIFY=1 \
python3 -m sglang.launch_server \
  --model-path inclusionAI/Ling-3.0-flash \
  --tp-size 4 --trust-remote-code \
  --speculative-algorithm DSPARK \
  --speculative-draft-model-path inclusionAI/Ling-3.0-flash-dspark \
  --attention-backend trtllm_mla \
  --flashinfer-allreduce-fusion-backend auto \
  --disable-radix-cache
```

两种配置用同样的方式基准测试：

```bash
python3 -m sglang.bench_serving --backend sglang \
  --dataset-name random --num-prompts 1000 \
  --random-input-len 8192 --random-output-len 1024 \
  --random-range-ratio 1.0 --max-concurrency 1
```

## 核心总结

- 在 4 张 Blackwell 上，NEXTN/MTP 路径把 Ling-3.0-Flash 单请求解码从 **288 tok/s** 提到 **606 tok/s**，Mean TPOT 从 **3.33ms** 降到 **1.53ms**（降 **54%**）；受控的 1000 请求对比里 DSpark 达 **1120 tok/s**、Mean TPOT **0.78ms**、接受长度 9.95，比 NEXTN 低 **1.9×**。
- 优化主线 = host run-ahead → PDL 链式连接 → 内核优化（两个融合 + KDA 重调 + bf16 gate/lm_head）→ DSpark；每步一次 host pin 的移除是结构性基础。
- 把 router gate 和 lm_head 从 fp32 降到 bf16 是结构之后最大的单点改动，约 **+10%**。
- 全程测量纪律：先做 profiler 标定、用 Mean TPOT×接受长度做 A/B、只报告但不对 peak 调优。
- 线性注意力的推测解码用「先暂存、后提交」方案：verify 禁用状态更新、只提交最后接受位置的状态。
- 剩余最大杠杆是 **fp8 权重**（结构性的 15–20%）；master 上的 router 融合已到终点，host 侧则是核心绑定与 GC 调优。

来源：[LMSYS Org Blog — Chasing the Batch-1 Floor: Ling-3.0-flash Speculative Decode on Blackwell](https://www.lmsys.org/blog/2026-08-21-ling3-flash-spec-decode-blackwell)（RadixArk SGLang 团队 + 蚂蚁 Ling 基础设施团队，2026-08-21）
