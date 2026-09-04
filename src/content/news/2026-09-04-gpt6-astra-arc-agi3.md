---
title: "GPT-6 Astra 登顶 ARC-AGI-3：行动效率首次超越人类基线"
description: "ARC Prize 实测 GPT-6 Astra：标准评测 62.7%，适配框架下高达 99.9%，96% 关卡行动数低于人类中位数。"
pubDate: 2026-09-04
author: "林晓"
category: "research"
tags: ["OpenAI", "GPT-6", "Astra", "ARC-AGI-3", "智能体", "基准测试", "行动效率", "ARC Prize"]
image: "/covers/2026-09-04-gpt6-astra-arc-agi3.jpg"
imageAlt: "封面：白灰左右分栏学术风，主标题 GPT-6 Astra，副标题 ARC-AGI-3 登顶，右侧 62.7% 与 99.9% 条形对比图"
topStory: true
---

9 月 3 日，ARC Prize 发布报告，公开了 OpenAI GPT-6 Astra 在最新一代智能体基准 **ARC-AGI-3** 上的实测成绩：<strong>Astra（max）在标准评测（Standard harness）下得分 62.7%、成本约 2.6 万美元；改用供应商适配（Provider Adapter）框架后得分冲到 99.9%、成本约 1.9 万美元</strong>，两项均为当前最优（state-of-the-art）。更值得注意的是，<strong>Astra 的行动效率也首次超过了人类基线——在 96% 的关卡上，它的操作次数比完成该关卡的普通测试者中位数更少</strong>。

## 关键结果

- **得分**：GPT-6 Astra（max）在 ARC-AGI-3 Semi-Private 上用标准评测得 62.7%（$26,098）；供应商适配框架下 Astra（high）得 99.9%（$18,817），均为 SOTA。
- **行动效率超越人类**：供应商适配框架下，Astra（max）在 96.0% 的关卡上操作数低于人类基线，平均每关少用 51.7% 的操作。
- **符号世界模型**：Astra 最亮眼的行为之一，是把陌生环境压缩成紧凑的符号世界模型——把游戏机制提炼成逻辑规则，并自创一套领域专用语言（DSL）速记来记录状态、规划行动。

## ARC-AGI-3 基准

ARC-AGI-3 是 ARC 系列第三代基准，用新颖、抽象、回合制的环境来研究「智能体智能」。智能体必须在没有明确指令的情况下主动探索、推断目标、在头脑中构建环境模型，才能有效规划行动。你可以在 ARC Prize 官网[亲自试玩](https://arcprize.org/tasks/ls20)这些关卡。

<video controls muted loop playsInline poster="/images/astra-arc-agi3/astra-arc-agi-3-poster.jpg" style="max-width:100%;border-radius:8px;">
  <source src="/images/astra-arc-agi3/astra-arc-agi-3.mp4" type="video/mp4"/>
</video>

这些环境只包含「核心知识先验」，难度通过受控的人类测试校准：**人类可以 100% 解出全部环境**（[人类数据集说明](https://arcprize.org/blog/arc-agi-3-human-dataset)）。整个 ARC-AGI 系列的目标，是测量当前 AI 与 AGI 之间的「残差差距」——其中 AGI 的定义是「系统能以人类同等的效率，习得人类能习得的任何技能」。ARC-AGI-3 在继承前两代的基础上，重点测试智能体智能的四个组成部分：

- **探索（Exploration）**：真实环境中的信息很少是送上门来的，智能体必须通过与周围互动主动获取；
- **建模（Modeling）**：把原始观察转化为可泛化的模型，用于预测未来的状态与结果；
- **目标设定（Goal-setting）**：在仅有稀疏奖励的情况下，识别出想要到达的目标状态；
- **规划与执行（Planning and execution）**：从当前状态规划出通往目标的路径，并在新信息出现时不断纠偏。

## Astra 的成绩

![ARC-AGI-3 排行榜上 GPT-6 Astra 的 SOTA 分数](/images/astra-arc-agi3/astra-arc-agi-3-leaderboard.png)

在各档推理强度下，Astra 用两套框架都拿到了 ARC-AGI-3 的 SOTA（[完整榜单](https://arcprize.org/leaderboard)、[Astra 完整结果](https://arcprize.org/results/openai-gpt-6-astra)）。一个反直觉的结论是：<strong>推理强度越高，成本往往反而越低</strong>——因为 Astra 用更少的动作就解完了游戏，总的模型调用次数与 token 用量随之下降。

| 推理强度 | 标准评测（Standard） | 供应商适配框架（Provider Adapter） |
|---|---|---|
| max | 62.7%，$26,098 | 98.6%，$17,332 |
| xhigh | 59.3%，$37,317 | 98.4%，$18,147 |
| high | 54.8%，$40,705 | **99.9%，$18,817** |
| medium | 38.6%，$48,090 | 98.4%，$19,285 |
| low | 17.5%，$38,166 | 98.0%，$21,298 |
| none | 35.2%，$49,791 | 96.7%，$23,457 |

作为成本参照，ARC Prize 在受控测试中按每 90 分钟 115 美元给人类参与者付费，另加每完成一关 5 美元。参与者每场约尝试九关，粗算每次尝试约 12.78 美元——这笔钱的大头是参与者的时间与意愿，而非大脑消耗的能量。若只按大脑代谢能量用电价折算，每场约 0.6 美分，平均每尝试一关约 0.067 美分。[^1]

## 分析：三个值得注意的现象

分数之外，Astra 的回放展示了它如何把陌生游戏的机制变成可用的工作模型。报告提炼出三点发现：**自创的紧凑代数记号、优于人类的行动效率、以及它亲手构建的定制工具**。

### 自创紧凑代数记号

玩 ARC-AGI-3 时，Astra 会主动决定把哪些「策略笔记」记在上下文里继续使用。它跟踪对象、坐标、规则与未完成的计划，同时使用一套<strong>为当前环境现场生成的领域专用速记</strong>。此前其他模型也出现过类似行为，但 Astra 的笔记以精确和信息密度见长：它把场景蒸馏成一段类似代码的紧凑符号模型——对象在哪、彼此如何交互、需要按什么顺序执行哪些动作。这是一种临场发挥的「代数速记」，而非完整的编程语言。例如：

- **游戏状态**：`L8: hub q2 (8↓). Lengths: 14=1…` 记录关卡、局部旋转索引与机关长度（[s5i5，第 219 帧](https://arcprize.org/replay/39d9f100-328a-4121-ad81-ce298e1f9626?frame=219)）；
- **多步计划**：`extend8 to3; retract10 to2; shorten8 to1` 记录对 8 号、10 号机关的有序改动（[s5i5，第 219 帧](https://arcprize.org/replay/39d9f100-328a-4121-ad81-ce298e1f9626?frame=219)）；
- **控制与坐标**：`9−=(39,4), rotate=(49,18), 14+=(59,11)` 把操作映射到对应控件的坐标（[s5i5，第 235 帧](https://arcprize.org/replay/39d9f100-328a-4121-ad81-ce298e1f9626?frame=235)）；
- **时间与位置**：`Turn 5: P=(24,20), empty, facing west` 组合回合计数、玩家位置、携带状态与朝向（[wa30，第 708 帧](https://arcprize.org/replay/be78fcef-1244-4cf8-b680-0a5e4e8f9afe?frame=708)）。

![Astra 游玩 s5i5，用自创代数速记跟踪状态并规划行动](/images/astra-arc-agi3/astra-symbolic-model.gif)

### 行动效率：首次超过人类

发布前，ARC Prize 招募了约 500 名普通公众做受控测试，为行动效率建立人类基线（方法见[人类测试论文](https://arxiv.org/pdf/2603.24621)）。每个关卡以「完成该关的参与者」操作次数的中位数作为人类基线：AI 用更少动作代表更高效，反之更低效。

在供应商适配框架下，<strong>Astra（max）在 96.0% 的关卡上操作数低于人类基线，平均每关少用 51.7% 的动作</strong>。ARC Prize 认为这是一个具有里程碑意义的结果：按 ARC-AGI-3 对行动效率的衡量，Astra 已追平并超过人类水准。

发布前 ARC Prize 原本猜测「行动效率」会长期是人与 AI 的分界线——即便 AI 能解出关卡，探索（动作）也可能远比人多。这对暴力搜索式的方法依然成立，但前沿模型呈现出更接近二分的模式：<strong>一旦它「理解」了机制，执行起来就在人类效率范围内</strong>。

![Astra 行动效率与人类基线对比（每点代表 Astra (max) 完成的一关，位于实线下方即比人类基线更省动作）](/images/astra-arc-agi3/astra-action-efficiency.png)

上图把 Astra 解每关所用的动作数与人类基线做了对比，也解释了为什么 ARC-AGI-3 测的不只是「能不能完成」。只测完成度，只能说明 Astra 解出了关卡，却看不出它学得到底快不快。多数基准只衡量<strong>成本效率</strong>（用了多少算力资源），而行动效率衡量的是<strong>解锁一个环境需要多少经验</strong>。Astra 的结果表明，它解出方案所需的交互次数比人类基线更少。

### 在智能体框架里自建工具

ARC Prize 还在 **PRO-LONG 框架**（[论文](https://arxiv.org/pdf/2607.20064)）中评估了 Astra——这是 ARC-AGI-3 早期的红队合作方。在这个更进阶的设置里，Astra 拥有一个可执行自定义代码的沙箱[^3]。

回放显示，Astra 会为每个游戏现做一套定制工具：棋盘解析器、游戏状态模型、搜索算法、规划器与持久化笔记；跑更复杂的关卡时，它甚至会产出小型、游戏专属的软件库。以 tu93（一个带守卫和移动巡逻队的迷宫游戏）为例：Astra 先做导航，写了 `maze_solver.py`；随后补上战斗规则 `combat_solver.py`、给移动的巡逻队建了 `patrol_solver.py`，再用 `sync_state.py` 拿自己的预测和观察对账。

![Astra 在 PRO-LONG 框架下游玩 tu93](/images/astra-arc-agi3/astra-pro-long-tools.gif)

PRO-LONG 结果的价值，在于能看到它借助外部工具时能做到什么。但要注意，这不同于人类受控测试的评测条件——测试参与者没有代码解释器、草稿本等，所以 PRO-LONG 的结果应理解为「模型 + 工具」的组合表现。

## 两套评测框架，回答两个问题

ARC Prize 的<strong>标准评测（Standard harness）</strong>问的是：模型在同一个最小的、与供应商无关的接口下表现如何。它提供解每关所需的全部信息，但把「要在可见笔记里保留什么」完全交给模型自己决定。ARC Prize 认为，未来的 AGI 应当能在这种条件下解出 ARC-AGI-3，统一的接口也保证了跨供应商一致的公平对比。

<strong>供应商适配框架（Provider Adapter）</strong>则是另一个问题：模型在能使用其供应商专门设计的上下文管理能力时表现如何？对 Astra 来说，就是在请求之间保留我们不透明的推理状态（内部状态我们看不到），并用压缩（compaction）管理更长的对话。

结果：<strong>Astra 在 ARC-AGI-3 Semi-Private 上观测到的最佳得分从 62.7% 升到 99.9%</strong>。跨越 Public 与 Semi-Private、全部推理档位统计，两套框架都解出的 167 对「游戏-推理」中，供应商适配框架汇总记录耗时约快 3.66 倍，总 token 用量少 49%。

今后 ARC Prize 会在排行榜上同时标注两种评测结果，并在其[开源测试仓库](https://github.com/arcprize/arc-agi-3-benchmarking)与[测试政策](https://arcprize.org/policy)文档中写明两种方法。

## 这算 AGI 吗？ARC Prize 自己说：不算

ARC-AGI-3 会继续作为研究者和智能体探索陌生环境、发现规则、在交互中学习的试验场。从 ARC Prize 的角度，Astra 的成绩「值得庆祝」——它代表前沿模型能力一次明显的<strong>阶跃式变化（step-function change）</strong>。

但 ARC Prize 自发布起就强调：**刷满基准并不代表「证明达到了 AGI」**。他们只说 Astra 在走向泛化的方向上取得了实质进展，<strong>并不宣称 Astra 就是 AGI</strong>。同时他们也指出，ARC-AGI-3 的范围与格式边界清晰，其环境是确定性、封闭式的机制与目标，并不代表真实世界的复杂度与开放性。

ARC 系列基准本身会与前沿 AI 同步进化，构成「新研究问题 ↔ 能力进步」的反馈循环。ARC-AGI-3 是系列中第一个交互式基准，要求 AI 在没有明确指令的情况下高效综合出因果世界模型并达成目标——<strong>Astra 越过了这根线</strong>。下一代会基准该评估什么，ARC Prize 正在思考的问题包括：如何评估递归自我改进、开放式创新。

> 致谢：François Chollet、Mike Knoop、Matt Mazur、Ethan Bond、Derek Smith 对本报告的早期审阅。

[^1]: 按大脑代谢功率 20 瓦、电价 $0.20/kWh 计算：0.020 kW × 1.5 小时 = 0.030 kWh，价值每场 $0.006，即每尝试一关 ≈ $0.00067。
[^3]: 报告称未观察到尝试逃出沙箱的行为。

原文：[OpenAI's GPT-6 Astra on ARC-AGI-3](https://arcprize.org/blog/astra)（ArcPrize / ARC Prize，2026-09-03）
