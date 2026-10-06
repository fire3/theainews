---
title: "NVIDIA Olympus 实测：用 3.3 GHz 和「空间多线程」冲服务器单线程性能上限"
description: "Chips and Cheese 实测 NVIDIA Vera 的 Olympus：10 宽乱序、3.3 GHz，单线程逼近桌面旗舰，但「空间多线程」在部分浮点负载出现负增益。"
pubDate: 2026-10-06
author: "林晓"
category: "research"
tags: ["NVIDIA", "Olympus", "Vera", "CPU 微架构", "SMT", "SPEC CPU", "Arm X925", "Zen 5"]
image: "/covers/2026-10-06-nvidia-olympus-core.jpg"
imageAlt: "封面：冷色学术风，浅灰底，左侧标题「NVIDIA Olympus 服务器单线程新上限」与三条要点，右侧为青色线条绘制的核心结构框图示意"
topStory: true
---

2026 年 10 月 5 日，硬件深度分析媒体 Chips and Cheese 发布了对 NVIDIA Vera 平台 CPU 核心 Olympus 的详测，作者是 Chester Lam。传统上服务器核心的单线程性能总比同期桌面核心弱，但这一差距在收窄：AMD 近两代服务器核心把频率越推越高，而 <strong>NVIDIA Olympus 选择了另一条路——不追频率，靠每时钟周期的性能（IPC）把服务器单线程性能顶到接近桌面的水平</strong>。

## 低频宽核：学 Cortex X925，再放大一圈

Olympus 是一枚 10 宽乱序核心，乱序结构大得「有点滑稽」，而频率只有 3.3 GHz——在今天的服务器里也不算高。这意味着它必须靠极强的单周期性能来达标。

它的总体布局与 Arm 的 Cortex X925 有很多相似之处：都用半分布式调度器、执行单元排布也接近，目标都是在不追高频率的前提下拿到高性能；区别在于 <strong>Olympus 把乱序结构做得比 X925 更大，并加上了 X925 没有的同步多线程（SMT）</strong>。此外 NVIDIA 在浮点调度器前放了一个不参与调度的队列（non-scheduling queue），这也是与 Arm 不同的设计。

![Olympus 核心总体结构：前端、执行引擎与内存子系统（图源：Chips and Cheese）](/images/olympus-core-01.jpg)

## 分支预测：方向预测略逊 X925，吞吐更激进

宽核加深重排序窗口，一旦分支预测错误代价很大，因此 Olympus 需要很强的预测器。在「不同模式长度的 taken/not-taken 分支」测试中，它略逊于 X925：X925 的方向预测器在少量分支下能跟踪约 1.6 万–2.4 万个全局历史模式，512 条分支时可超过 6.4 万；Olympus 对应约为 5000–6000 和 4.8 万。

![分支预测器的模式识别能力测试（图源：Chips and Cheese）](/images/olympus-core-02.jpg)

到 SPEC CPU2026 上，其预测准确率与 Intel、AMD 最好的核心相当：略低于 AMD Zen 5，略高于 Intel Lion Cove。各负载互有胜负，说明想用一个预测器覆盖各种程序行为有多难。浮点套件对分支预测更友好，Olympus 凭借 731.astcenc 的大幅领先整体反超 Intel 与 AMD。

![SPEC CPU2026 整数负载的分支 MPKI（图源：Chips and Cheese）](/images/olympus-core-03.jpg)

![SPEC CPU2026 浮点负载的分支 MPKI（图源：Chips and Cheese）](/images/olympus-core-04.jpg)

预测速度同样关键，因为代码里 taken 分支很常见。与 Zen 5 一样，Olympus 每个周期能处理两条 taken 分支；但不同于 Zen 5 和 X925，<strong>它的这一能力绑定的是指令足迹而非分支数量——指令足迹超过 48 KB（大致对应指令缓存容量）后，每周期两条 taken 分支的能力就会失效</strong>，此时改用 16K 条目、4 周期延迟的 BTB。

![分支目标缓存：不同指令间距下的每分支周期数（图源：Chips and Cheese）](/images/olympus-core-05.jpg)

![16 字节间距下的分支目标缓存表现（图源：Chips and Cheese）](/images/olympus-core-06.jpg)

双线程时，NVIDIA 把分支目标缓存结构一刀切分，每个线程各得约一半容量，即使两个线程属于同一进程、共享地址空间也不能共享条目；从每个线程看，16K 条目的二级 BTB 每 5 个周期才给出一个目标，从核心整体看约每 2–3 个周期一个。

![动态分支（每 8 次迭代一次 not-taken），16 字节间距（图源：Chips and Cheese）](/images/olympus-core-07.jpg)

NVIDIA 与 AMD 都使用「提前索引」（ahead indexing），一次查表为接下来两条分支给出预测。NVIDIA 声称 Olympus 凭借更完善的流水机制，每周期预测数可达竞品的 2.3 倍。

![每周期分支预测数：NVIDIA 宣称最高 2.3 倍（图源：Chips and Cheese）](/images/olympus-core-08.jpg)

作者对此持保留态度：两家的架构都不提供统计预测次数的硬件计数器，无法验证；而且「每周期预测数」本身未必是有意义的指标——预测错误之后的预测毫无价值，前端喂得动时多预测也不提升性能。另一种解释是：Olympus 本就设计成每周期推进更多指令流，所以预测数自然更多；Zen 5 则是为高频率设计。把频率算进去后，两者完成分支的速率其实相差不远。

![已退休分支的每周期数与实际速率对比（图源：Chips and Cheese）](/images/olympus-core-09.jpg)

## 取指与重命名：128 B/周期，但双线程被腰斩

取指地址先经 64 条目全相联指令 TLB 翻译，再从 64 KB 四路组相联指令缓存取指，<strong>每周期可向 48 条指令的解码队列送入 128 字节</strong>；128 字节最多含 32 条指令，远超解码吞吐，其用意大概是在长延迟分支或预测错误后让前端快速追上。

![指令取指带宽随测试规模变化（图源：Chips and Cheese）](/images/olympus-core-10.jpg)

大指令足迹表现不错，能从 L2 以 32 B/周期取指，单线程的 L2 代码吞吐明显高于 Zen 5 与 X925；一旦指令溢出到 L3，吞吐同样骤降。但核心跑两个线程时，<strong>不到 1 MB 就出现取指带宽的断崖式下跌，说明 Olympus 对 L2 做了静态切分</strong>——哪怕兄弟线程只是跑个几指令的小循环、完全不访存也一样；一个高 IPC 线程（纯 NOP）的吞吐会直接减半，即使另一个线程正卡在低 IPC 的长延迟上。

![1 GB 规模下的 SMT 数据侧内存延迟争用测试（图源：Chips and Cheese）](/images/olympus-core-11.jpg)

重命名与派发环节可以顺带做一些优化，比如 move 消除。Olympus 的 move 消除能力有限：依赖 MOV 链的吞吐约为每周期 1 条略多，说明只有部分 MOV 以零延迟执行；相比之下 Zen 5 每周期能跨 5 条 MOV。有趣的是，<strong>开两个线程后 Olympus 的每线程 move 消除反而变好</strong>，达到每线程 1.7 条/周期（合计 3.5 条）；Zen 5 总量升到 7 条/周期，但每个线程从 5 条降到 3.5 条。

## 后端：寄存器堆和队列大到夸张

Olympus 的后端到处是巨大的寄存器堆和队列，整体像 X925 的加强版。唯一条目数偏少的是浮点/向量寄存器堆（比 Zen 5 少），但它常用一个 128 位向量寄存器同时容纳两条独立指令写入的标量浮点值——考虑到大量代码无法向量化，这个优化很实用。

用 NOP 测试可以测出在飞指令数量的上限：核心能在两个长延迟加载之间塞进 1000 条以上 NOP，但实际在飞指令数受限于约 606 个已分配架构寄存器，会明显低于这个数字。

![各核心结构条目数对比：Olympus vs Cortex X925 vs Zen 5（单线程最大可用）（图源：Chips and Cheese）](/images/olympus-core-12.jpg)

调度器布局同样借鉴 X925：8 个整数 ALU 两两成对，每对由一个约 25 条目的调度队列供给，其中一对 ALU 专门处理不常见的运算；浮点侧为六管 FPU，也是每对管线配一个队列。区别在于 NVIDIA 用「不参与调度的队列 + 较小的调度队列」的组合，Arm 则用三个很大的调度队列。

作者检查的所有后端结构都是静态切分的：只要兄弟线程不空闲，每个线程就只能拿到一半（或更少）容量——连通常采用水位线或竞争共享的调度队列也不例外，执行单元同样如此，吞吐直接减半，不管兄弟线程是否争用同一端口。作为对比，<strong>AMD 的 SMT 大部分结构是灵活共享的，只用水位线防止一个线程独占资源</strong>。

![双线程（SMT2）下两家核心的资源切分方式对比（图源：Chips and Cheese）](/images/olympus-core-13.jpg)

## 载入/存储：四条流水线，和 32 B 边界的怪停顿

访存走四条流水线，全部支持载入，其中两条支持存储。L1 数据缓存标称延迟 4 周期，但简单的内存延迟测试能测到 2–3 周期，作者推测可能来自值预测（value prediction）。

内存消歧（memory disambiguation）行为更像 Arm 的旧核心或 Intel Atom：64 位存储转发给依赖的 32 位载入时，只要载入对齐到存储的任一半即可快速转发——地址完全匹配时延迟 3–4 周期，转发上半部 5–6 周期；其余重叠情形会吃到 12–13 周期的惩罚，很可能是核心挡住了载入、等存储提交。

![存储到载入转发的延迟矩阵（图源：Chips and Cheese）](/images/olympus-core-14.jpg)

更奇怪的是，Olympus 在跨越 64 B 缓存行正中间那条 32 B 边界时会「卡一下」，而跨越整条 64 B 缓存行边界时反而不卡——尽管每条 64 B 对齐边界自然也 32 B 对齐。此外，同一条缓存行前半 32 B 末尾那个 32 位块上的独立载入与存储，有时不能并行推进。

![另一组存储转发延迟矩阵，可见 32 B 边界处的异常（图源：Chips and Cheese）](/images/olympus-core-15.jpg)

更宽的向量访问在中间 32 B 边界有同样表现，还会在缓存行内第一条 16 B 对齐边界上再额外卡一下；向量存储转发的延迟更高，这在很多核心上属于常态。

地址翻译方面，Olympus 有 112 条目全相联数据 TLB，背后是统一的三千条目 L2 TLB。Zen 5 则是 96 条目全相联数据 TLB 加 4000 条目的 L2 数据 TLB，且 AMD 不用统一 L2 TLB，指令侧另有 2048 条目的 L2 指令 TLB。测试机器使用 64 KB 页，让地址翻译在很多测试里几乎不构成延迟因素，也让直接对比更困难。

## 缓存与内存：96 KB L1D、2 MB L2、164 MB L3

大乱序结构、预取器、分支预测和值预测帮核心「忍受」内存延迟，缓存则从另一边降低延迟。Vera 的缓存策略相比此前的 Grace CPU 有大幅改进：<strong>Olympus 的 L1 数据缓存达到 96 KB、六路组相联，容量超过 AMD、Arm、Intel 服务器核心常见的 32/48/64 KB</strong>。

![大页下的缓存与内存延迟曲线（图源：Chips and Cheese）](/images/olympus-core-16.jpg)

L1 未命中由 2 MB 八路组相联的 L2 接住，载入到使用 10 周期。周期数低意味着尽管 X925 频率高达 4 GHz、L2 延迟 12 周期，Olympus 的 L2 交付速度仍几乎相当。2 MB 的 L2 容量也是相对 Grace（Neoverse V2，只有 1 MB L2）的显著升级。Vera 的 L3 延迟与 Grace 相当，绝对值不佳（超过 120 周期），但这在以巨型单体互连实现 L3 的设计中很常见；好在容量从 114 MB 提升到 164 MB。

![单线程读带宽：L1、L2、L3 到内存（图源：Chips and Cheese）](/images/olympus-core-17.jpg)

NVIDIA 用激进的预取来弥补 L3 高延迟：单线程线性读可从 L3 跑到 88.53 GB/s，按 Little 定律推算，Olympus 能维持约 50–51 个在飞请求（88.53 GB/s ÷（64 B × 3.3 GHz）≈ 0.42 条缓存行/周期，乘以 121.5 周期延迟 ≈ 50.9），而 Grace/GH200 只有 35–36 个。用 Lemire 的内存级并行微基准测试，Olympus 可同时有 18–19 个需求型 L1D 未命中在飞；该测试用随机指针追逐，无法借助 L2 预取器，所以也吃不到更大 L2 未命中队列的好处。

![长模式大页下，加 BTB 压力后的小规模争用表现（图源：Chips and Cheese）](/images/olympus-core-18.jpg)

SMT 同样切分 L1D 与 L2 的数据容量：兄弟线程活跃时，每个线程只能用到核心私有缓存的一半，即便兄弟线程完全不访问数据也一样。

## SPEC CPU2026：服务器核心逼近桌面旗舰

SPEC CPU2026 的成绩显示，Olympus 为服务器核心提供了非常强的单线程性能，与桌面环境的 Intel Core Ultra 9 285K、AMD Ryzen 7 9800X3D 相差不远；对上 Neoverse V2、Neoverse N2 等 Arm 服务器核心则有明显领先。需要注意的是测试机使用 64 KB 页，而其他成绩都在 4 KB 页下取得；作者预计即使换成更小页，Olympus 在 Neoverse 面前依然占优。

![SPEC CPU2026 估算总分：整数与浮点（图源：Chips and Cheese）](/images/olympus-core-19.jpg)

细化到单项，NVIDIA 在大量整数负载上表现良好，包括其白皮书点名的 723.llvm_r、727.cppcheck_r、721.gcc_r、714.cpython_r。它在 706.stockfish_r 上大幅落后 Zen 5，主要原因是指令集差异——该负载下 Olympus 执行的指令数约为 Zen 5 的两倍；浮点侧 772.marian_r 同样受 ISA 影响。指令数也可能反过来，例如 aarch64 在 750.sealcrypto_r 上需要更少指令，但 Zen 5 靠整体吞吐优势仍保住成绩。

![SPEC CPU2026 各单项估算成绩（整数/浮点）（图源：Chips and Cheese）](/images/olympus-core-20.jpg)

既然目标是靠每周期性能取胜，硬件计数器显示 IPC 很高也就不奇怪：<strong>即使在做 Zen 5 性能更高的负载里，Olympus 的 IPC 往往也更高</strong>。

![SPEC CPU2026 各负载 IPC 对比（图源：Chips and Cheese）](/images/olympus-core-21.jpg)

宽流水线很难喂饱。自上而下（top-down）分析显示，几乎所有负载平均都有超过 50% 的派发槽位闲置；SPEC 整数负载大量损失在「前端供给不足」上——即便有提前两条的快速分支预测器和大指令缓存，也未必跟得上，Zen 5 同样如此。浮点负载更偏「后端受限」，即微操作因后端资源占满而无法派发，也就是核心已经到了在飞指令数的上限。

![SPEC CPU2026 流水线槽位归因：前端受限与后端受限（图源：Chips and Cheese）](/images/olympus-core-22.jpg)

## 「空间多线程」：把一颗核心一分为二

SMT 的初衷是在有第二个线程时回收闲置的核心宽度、更充分利用后端资源。NVIDIA 的「空间多线程（spatial multithreading）」很不常规：在 SPEC CPU2026 整数负载上，<strong>它的 SMT 增益与 Zen 5 相当</strong>（这里看的是增益；绝对性能上 Zen 5 更高，但两者定位不同——桌面 CPU 本就以单核性能为目标）。

![SPEC CPU2026 的 SMT 增益：Olympus vs Zen 5（图源：Chips and Cheese）](/images/olympus-core-23.jpg)

浮点侧的说服力就弱一些，尽管整体仍有可观提升。单项差异很大：低 IPC、前端受限的负载（如 723.llvm）从 SMT 中获益巨大，而高 IPC、吞吐受限的负载（如 750.sealcrypto、714.cpython）收益有限——两家核心的总体规律一致。

![SPEC CPU2026 整数负载的 SMT 增益明细（图源：Chips and Cheese）](/images/olympus-core-24.jpg)

问题出在浮点：<strong>Olympus 在 709.cactus 和 782.lbm 上出现了吞吐倒退</strong>。理想的 SMT 实现不应在双线程时损失总吞吐，因此这两处显得不理想；Zen 5 在 SPEC 浮点上的 SMT 收益也不高，但至少没有出现「双线程比串行跑两个任务更差」的情况。

![SPEC CPU2026 浮点负载的 SMT 增益明细（图源：Chips and Cheese）](/images/olympus-core-25.jpg)

## SPEC CPU2017：与 Zen 4 桌面旗舰打平

SPEC CPU2017 仍具价值，因为它包含 SPEC CPU2026 中没有对应物的困难负载，作者手上的历史数据也更多。数据显示 Olympus 击败了多个服务器核心，包括一个 Zen 5 服务器实现，并与 AMD 顶级 Zen 4 桌面芯片打平——对服务器核心来说相当了不起。

![SPEC CPU2017 估算总分（图源：Chips and Cheese）](/images/olympus-core-26.jpg)

SPEC CPU2017 的 SMT 增益比 CPU2026 更高，这得益于那些让分支预测器「崩溃」、又受后端内存延迟拖累的负载，比如 505.mcf。Olympus 在浮点侧再次出现令人担心的 SMT 倒退；AMD Zen 4 也未能幸免，但幅度轻得多——3% 或 1% 的下降远谈不上理想，却大概比 11.98% 或 9.78% 的损失更不易察觉。

![SPEC CPU2017 的 SMT 增益（图源：Chips and Cheese）](/images/olympus-core-27.jpg)

![SPEC CPU2017 整数与浮点负载的 SMT 增益明细（图源：Chips and Cheese）](/images/olympus-core-28.jpg)

要解释 Olympus 的 SMT 行为并不容易，因为分析 SMT 用例本就比单线程难。709.cactus 可以用「跑两份负载时 L2 数据 MPKI 从 3.58 升到 6.52，加上后端资源被切分后难以承受高 L3 延迟」来解释；但 SPEC CPU2017 的 503.bwaves 和 549.fotonik3d 套不上同一套逻辑：503.bwaves 在单线程和双线程下都在冲刷 L2（MPKI 32.12 对 33.03），而自上而下事件显示性能损失并非内存受限所致；549.fotonik3d 的 L2 未命中率也很高（单线程 52.45，双线程 57.13），但相对差距同样不大。总体看，<strong>空间多线程在前端受限负载上能给出与常规 SMT 相当的可观增益，但对后端受限负载处理得不够好</strong>。

![709.cactus、503.bwaves、549.fotonik3d 的槽位归因（图源：Chips and Cheese）](/images/olympus-core-29.jpg)

作者对「空间多线程」的判断是：它与其说是常规 SMT，不如说是双线程时把 Olympus 动态拆成两颗更小的核心。几乎所有能想到的资源、直到 L2 缓存都是静态切分的，每个线程只能拿到一半。这样做的好处很实在——把两个 SMT 线程当成两颗 5 宽核心来看，性能分析比分析 Zen 5 里两个线程如何动态争用资源简单得多；对核心设计来说也更省事，NVIDIA 不必去调那些复杂机制来保证公平，因为「一切减半」本身就是公平保证。

![NVIDIA 白皮书中的空间多线程确定性隔离示意（图源：NVIDIA Vera 白皮书）](/images/olympus-core-30.jpg)

但这是好主意，还是为了简化第一代 SMT 实现而做的妥协，作者认为尚无定论。空间多线程在 SPEC 整数负载上展现了希望；在最理想的情况下，Olympus 说明只要核心资源足够巨大，两个线程如何共享资源可能并不那么重要。然而收益并不稳定，在 SPEC 浮点的后端受限场景里甚至为负。这些波折究竟来自第一代 SMT 的磨合问题，还是来自「把每个线程锁死在半颗核心」带来的根本性低效，目前很难判断——毕竟常规 SMT 的一部分收益，正来自让线程动态取用兄弟线程闲置的资源。作者的建议是继续观察 NVIDIA 是否会在后续世代沿用这一策略：成功的架构技术通常会被延续并被业界采纳，而空间多线程会不会如此，谁也说不准。

## 结语

Arm 早期的服务器芯片重核数而轻单核性能，随着新核心不断上探性能目标，Arm 服务器阵营已经多元化；如今 NVIDIA 的 Vera 反过来成了单线程性能顶尖、核数相对较少的那一方（不过 88 核在绝对数量上依然很多），而 AMD 的服务器芯片核更多、单线程性能更低。不同页大小给 SPEC 结果留了一些模糊空间，但作者认为这只会缩小 Olympus 与最快 AMD 服务器核心的差距，不会改变相对排名。

![NVIDIA Olympus 核心架构（图源：NVIDIA Vera 白皮书）](/images/olympus-core-31.jpg)

对上 Arm Neoverse 阵营，Olympus 在每核心吞吐上占尽优势：既因为单线程性能高，也因为第二个线程能进一步拉高吞吐——当 Arm 核心根本无法同时跑第二个线程时，讨论常规 SMT 与空间多线程孰优孰劣已无意义。相比上一代 Grace（无论是更快的核心还是更多的核心），Vera 是一次巨大跃升。

## 核心总结

- <strong>总体设计</strong>：10 宽乱序、3.3 GHz 的低频宽核，靠 IPC 而非频率取胜；布局借鉴 Arm Cortex X925 并进一步放大乱序结构，另加 SMT
- <strong>前端</strong>：分支方向预测略逊 X925，SPEC CPU2026 准确率略低于 Zen 5、略高于 Lion Cove；每周期两条 taken 分支，但超过 48 KB 指令足迹即失效；64 KB 指令缓存、128 B/周期取指
- <strong>后端</strong>：寄存器堆与队列规模巨大，实际在飞指令受约 606 个寄存器限制；几乎所有资源（含 L1D/L2 缓存与执行单元）在双线程时静态减半，与 Zen 5 的灵活共享形成对比
- <strong>访存</strong>：96 KB L1D、10 周期 2 MB L2、164 MB L3；L3 延迟超 120 周期但靠激进预取维持约 50–51 个在飞请求；存储转发在缓存行中间 32 B 边界有异常停顿
- <strong>性能</strong>：SPEC CPU2026 单线程接近桌面旗舰，SPEC CPU2017 与 Zen 4 桌面打平；整数负载常受前端限制，浮点负载多受后端限制，IPC 普遍高于 Zen 5
- <strong>空间多线程</strong>：整数负载增益与 Zen 5 相当，浮点后端受限负载出现负增益（709.cactus、782.lbm），本质是双线程时把核心拆成两颗 5 宽核心；是否长期沿用尚待观察

原文：[NVIDIA's Olympus Core: Pushing Server Single Threaded Performance Boundaries](https://chipsandcheese.com/p/nvidias-olympus-core-pushing-server)（Chips and Cheese，2026-10-05）
