---
title: "Anthropic 发布 Claude Fable 5.2 与 Mythos 5.2：同一底座、两套护栏，主打长时程自主任务"
description: "Anthropic 发布 Fable 5.2 与 Mythos 5.2：同一底座两套护栏，FrontierCode 2.0 达 49.1%，千个智能体 30 小时形式化费马大定理。"
pubDate: 2026-11-09
author: "林晓"
category: "models"
tags: ["Anthropic", "Claude Fable", "Claude Mythos", "模型发布", "智能体编码", "基准评测"]
image: "/covers/2026-11-09-anthropic-fable-mythos-5-2.jpg"
imageAlt: "封面：深炭黑底、青绿斜切色块，居中大字标题「Fable 5.2 与 Mythos 5.2」，副标题标注同一底座、两套护栏与 8 美元/百万输入 token"
topStory: true
---

11 月 9 日，Anthropic 发布 Claude Fable 5.2 与 Claude Mythos 5.2。两者底层是<strong>同一个模型</strong>，差别在护栏：Fable 带强网络安全与生物安全分类器，因此可以向所有用户开放；Mythos 没有这层限制，只通过 Cyber Verification Program 与 Life Sciences Verification Program 提供给通过审核的组织。价格是每百万输入 token 8 美元、每百万输出 token 40 美元，比 Fable 5.1 更低；可选的快速模式（Fast mode）价格为 16 / 80 美元，token 生成速度最高提升到 2.5 倍。

Anthropic 给出的定位很明确：日常编码与知识工作仍推荐从 Opus 5.5 起步，遇到更大范围、更高复杂度的工作时再上切到 Fable 或 Mythos，简单任务则下沉到 Sonnet 5.5 或 Haiku 5.5。Fable 5.2 也可以扮演<strong>顾问（Advisor）</strong>——由 Haiku、Sonnet、Opus 在难题上向它请教——或者<strong>编排者（Orchestrator）</strong>，把简单任务分派给更小的模型。

## 价格下来了，「努力档位」更关键

Anthropic 强调的不是单纯变强，而是在同等花费下变强。官方给出的几组对照：

- 在 FrontierCode 2.0 上，Fable 5.2 用 High effort 拿到约 45.3%，与 Opus 5.5 的最高分 45.5% 基本持平，而每个任务的成本约为后者一半
- Humanity's Last Exam 带工具，Fable 5.2 在 Low effort 下就追平 Opus 5.5 的最高分，单任务成本不到十分之一
- Chartography 读图表测试中，Fable 5.2 在 Medium effort 拿到 66.4%，高于 Opus 5.5 在 Max effort 的 64.4%
- WANDR 大型数据收集任务上，Medium effort 追平 Opus 5.5 的最高分，成本约为 40%

输出速度上，官方称比 5.1 快最多 30%，且在 Claude 应用与 Claude Code 的默认 Medium effort 下，完成同样难度的任务所用 token 更少。

## 基准：多数项目领先，但并非全胜

官方公布的对照表里，Fable 5.2 在绝大多数项目上高于 Opus 5.5，但个别项目仍有对手领先。

| 基准 | Fable 5.2 | Fable 5.1 | Opus 5.5 | GPT-6 Astra | Gemini 4 Carbon |
| --- | --- | --- | --- | --- | --- |
| FrontierCode 2.0（智能体编码） | **49.1%** | 32.4% | 45.5% | 42.8% | 41.1% |
| FrontierSWE v2 | **69.9%** | 56.3% | 62.3% | 65.5% | 61.2% |
| AutomationBench（业务流程） | 51.4% | 31.4% | 42.5% | 41.4% | **53.9%** |
| Terminal-Bench-Science 0.1 | 74.6% | 52.6% | 58.7% | 68.1% | 64.8% |
| OSWorld 2.1（计算机操作） | **89.3%** | 83.5% | 87.2% | 79.5% | 81.5% |
| AA-Briefcase v1.1（rubric） | **66.1%** | 61.5% | 61.2% | 52.0% | 61.8% |
| Humanity's Last Exam（带工具） | **74.2%** | 65.6% | 67.7% | 57.2% | — |
| Chartography（无工具） | **73.4%** | 44.8% | 64.4% | 71.0% | 72.5% |
| RoboDojo Sim | **64.9%** | 27.6% | 39.4% | 29.8% | — |
| Remote Labor Index | **41.3%** | 17.9% | 21.3% | 20.8% | — |

两处值得注意的例外：AutomationBench 上 Gemini 4 Carbon 以 53.9% 高于 Fable 5.2 的 51.4%；AA-Briefcase 的 Elo 评分里 Opus 5.5 是 1800，Fable 5.2 为 1785，尽管 rubric 分数反过来。Mythos 5.2 的两项专长分数则单独列出：CyScenarioBench 76.3%，CVE Rediscovery 89.6%。

## 编码：内部九成合入代码由 Claude 写

Anthropic 称，目前合入其核心代码库的改动中<strong>超过 90%</strong> 由 Claude 在人类指导下完成。一个由智能体组成的团队把关键生产服务从 Python 迁到了 Rust，服务启动速度约提升 26 倍。另一名工程师让 Fable 5.2 从空文件夹开始设计一个操作系统原型：模型协调<strong>超过 1000 个子智能体</strong>，连续工作八天，产出一个能在笔记本上启动的系统，含内核、磁盘/键盘/网络驱动、持久化文件存储、窗口、登录界面与安装器。

## 科研：黑洞、衣壳与费马大定理

![Anthropic 展示的 AAV 衣壳结构渲染，该类蛋白外壳可用作基因治疗载体。](/images/2026-11-09-anthropic-fable-mythos-5-2/aav-capsid.jpg)

Fable 5.2 解决了两个理论物理的开放问题，都关于黑洞，也都依赖全息对偶。第一个问题是：1983 年物理学家证明这类宇宙升温时黑洞会像水沸腾一样突然形成，但方法只适用于大到能使用相对论的大宇宙；2003 年有人给出了小宇宙情形下的计算方案，因过于繁琐一直没做完。Fable 5.2 基本自主地完成了这项计算，发现小宇宙里的转变同样是突变的。第二个问题是它找到了物理学家使用了 15 年以上的某种排除方法的精确边界。两项结果各自有预印本。

生物方面，Mythos 5.2 在 AlphaFold 类模型的基础上另辟蹊径：把多条蛋白链分成互相重叠的组分别预测，再利用衣壳已知的对称性把结果拼合起来，从而预测整个衣壳结构。测试中它准确建模了 34 个衣壳中的 28 个；单个 AAV2 衣壳在 H200 上约需 58 分钟（OpenFold3-preview2）或 7 分钟（ESMFold2）。

数学形式化是另一个标志性案例。Anthropic 早先由未发布的研究版 Claude 完成费马大定理的形式化，耗时 11 天，且依赖专用框架与人类研究员指导；这次<strong>1000 个 Fable 5.2 智能体</strong>只用 30 小时就完成，人类干预极少，模型从最简提示出发自行建立协作方式，只靠一份中间定理清单来评估进度。它消耗的动作 token 是首次的三分之一，产出的证明短七倍。作为对照，同样 1000 个智能体的 Opus 5.5 在 18 小时内只完成 26%，跑到 30 小时也仅到 27%。

## 硬件与机器人：一天做完一块四层板

![Claude 参与设计的电路板之一：从选型、布板到外壳建模与固件均由其完成。](/images/2026-11-09-anthropic-fable-mythos-5-2/hardware-pcb.jpg)

在一段话的提示下，Fable 5.2 与电路板公司 Diode 合作设计了三款带自制电路板、3D 打印外壳与软件的电子设备：家用语音助手中枢、USB 会议音箱、掌上电子宠物。模型自己写规格、从美国分销商处选元器件、完成四层板布线、用 CAD 建模外壳并编写固件；每块板从零到可投产不到一天，三款设备最终都无需电气改动即可工作。

机器人控制上的提升更出人意料：在测试双臂仿真机器人的 RoboDojo 基准上，Fable 5.2 以 64.9% 超过 GPT-6 Astra 的 29.8% 与 Fable 5.1 的 27.6%；实机演示里它完成了拼魔方、拧开瓶盖、画简笔画等任务，其中不少没有专门训练过。

## 安全：沙箱逃逸率降到 3.1%

Anthropic 在同一个底座模型上做了发布前安全测试，其中包括针对沙箱逃逸的新评估。在一个含 1800 多个场景、且沙箱故意留有弱点的对抗性测试中，Mythos 5.2 有 3.1% 的场景动用了沙箱外的凭据或文件，与 Opus 5.5（3.3%）相当，低于 Sonnet 5.5（5.1%），远低于此前 Mythos 5 的 39% 与 Mythos 5.1 的 21%。在约 1900 个场景的自动化行为审计中，Mythos 5.2 的综合失准分为 2.67（越低越好），优于 Mythos 5.1（3.28）、Sonnet 5.5（3.10）与 Opus 5.5（2.79）。官方评估高利害场景下的失准风险为低。

护栏方面，Fable 5.2 的拦截总量比 5.1 减少约 55%——网络安全约降 60%、生物约降 40%，即误伤明显减少。反蒸馏上，官方称新防护让蒸馏者能采集到的数据减少了 90%–99%，同时把「保留思考（preserved thinking）」开放给所有账户，防止蒸馏者改动上下文来套取推理过程。

值得一提的是，Anthropic 主动限制了模型在 AI 研发方向上的进展：在加速器内核优化、改进大语言模型架构这类最直接加速 AI 自身发展的能力上，Fable 5.2 与 Mythos 5.2 只做到 Opus 5.5 的水平，且推理阶段不做额外削弱。官方称这一限制不影响智能体编码、硬件开发、可解释性研究等相关能力。

## 可用性

Fable 5.2 发布当天即可在 AWS、Google Cloud、Microsoft Azure 等平台使用，API 名为 `claude-fable-5-2`。快速模式覆盖 Claude Code、Claude Platform、Google Cloud 与 Microsoft Foundry，Mythos 的快速模式仅限验证计划内的组织。发布周内，符合条件的付费订阅者会获得 1–3 次 Fable 额度重置，Pro 与 Team 标准席位每周用量上限中最多 50% 可用于 Fable。

## 核心总结

- Fable 5.2 与 Mythos 5.2 是同一底座的两种发布形态，区别仅在于网络安全与生物安全护栏，以及由此决定的开放范围
- 定价 8 / 40 美元（每百万输入 / 输出 token），快速模式 16 / 80 美元；官方主打的是同成本下的能力提升，而非单纯跑分
- FrontierCode 2.0 得 49.1%，为官方测试过的已发布模型最高；但 AutomationBench 仍落后 Gemini 4 Carbon，AA-Briefcase 的 Elo 也不及 Opus 5.5
- 长时程自主任务是核心卖点：千级子智能体协作八天造出可启动的操作系统、30 小时完成费马大定理形式化、一天完成一块可投产的四层电路板
- 安全侧的两组数字更能说明取向：沙箱逃逸率 3.1%、误拦截减少约 55%

原文：[Introducing Claude Fable 5.2 and Claude Mythos 5.2](https://www.anthropic.com/claude-fable-and-mythos-5-2)（Anthropic，2026 年 11 月 9 日）
