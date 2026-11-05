---
title: "OpenAI 的 948 个补丁去了哪：LKML 实录、AI 审 AI 与维护者的「18 个月」"
description: "交叉核查 OpenAI 漏洞报告的内核落地：单账号 3 分钟连发 20 封补丁、mptcp 修复进入稳定分支、LLM 声明成惯例，以及 Sashiko 与维护者的态度。"
pubDate: 2026-11-05
author: "林晓"
category: "industry"
tags: ["OpenAI", "Linux 内核", "LKML", "Sashiko", "漏洞修复", "Greg KH", "AI 安全", "kernelCTF"]
image: "/covers/2026-11-05-lkml-openai-948-followup.jpg"
imageAlt: "封面：深炭黑杂志风配珊瑚红，标题「948 个补丁的去向」，底部三张卡片标注 20 封、51 条、18 个月"
topStory: false
---

上一篇我们按 OpenAI 官方口径拆了那条自主漏洞流水线的成本与产出。这一篇换个方向：<strong>不去看它宣称了什么，而是去看它在公网上留下了什么痕迹</strong>。信源是 Linux 内核邮件列表归档 lore.kernel.org、Linux 基金会的 Sashiko 项目、Hacker News 的讨论串，以及 GitHub 上的相关仓库。

结论先说：**这轮工作的「指纹」在邮件列表里清晰可查**——批量提交、署名人类、附复现器、被维护者逐条技术评审，其中有修复已经合并进上游并回移到 5.15 到 6.18 的稳定分支；但同时，它也给一个本已在超负荷运转的社区又压上一摞活。

## 邮件列表里的指纹：3 分钟，20 封

2026 年 10 月 30 日 UTC 04:21:01 到 04:23:53，`kylebot@openai.com`（署名 Kyle Zeng）在 lore 上连续发出 **20 封内核补丁**，横跨二十个子系统：io_uring/io-wq、net/rds、rxrpc、net: skmsg、batman-adv、br_netfilter、cfg80211、net: gro、ip6mr、ipv4 XFRM、macsec、mpls、mptcp pm、openvswitch、net/sched、sctp、net: skbuff、vfio、iommufd、xfrm。

这种节奏本身就是证据：单个账号、同一分钟内、跨子系统批量投递，与「AI 流水线产出、人类审核署名」的描述吻合。往前追溯，同一地址在 10 月 16 日讨论 `mm/page_vma_mapped`、10 月 19 日发 `futex` v2、10 月 23 日发 `tracing`、10 月 24 日发 `fs/proc` 的 PAGEMAP_SCAN 修复——说明这不是一次性事件，而是持续两周多的输出。

## 一封补丁的完整链路：sctp

挑一封能看清全貌的。11 月 3 日，同一账号发出 `[PATCH net v2] sctp: avoid requeueing pending control chunks`，正文写得像正常内核补丁：T4 与 RE-CONFIG 超时处理函数会对缓存的 control chunk 再取一次引用并通过 `SCTP_CMD_REPLY` 提交；若前一次传输还留在 control outqueue（输出被 cork 或抑制时），`sctp_outq_tail()` 就会把同一个链表节点加第二次，KASAN 在 `__sctp_outq_teardown()` 报 use-after-free；ASCONF 路径**普通用户的 SCTP socket 就能复现**。

几处细节值得记录：

- 正文里明确写着 <strong>「The issue was found by an LLM.」</strong>——不是藏在脚注，而是与 `Fixes:`、`Cc: stable` 并列。
- 补丁尾部的 git 版本是 `2.55.0.openai.911.g06873a30d2f3`，带 OpenAI 内部构建后缀。
- 附了一句：<strong>「I have a reproducer for this issue and can share by DM.」</strong>——复现器在手上，但要私下给。
- 有 `Suggested-by: Xin Long`，说明上一轮评审里，SCTP 维护者给出了修复方向。

Xin Long 的回复（11 月 3 日）同样值得一字不落看：<strong>「我不太理解，如果这个 chunk 不是由本次超时入队的，为什么还需要 OUTQ_FLUSH？能否分享复现器，帮助理解是什么导致 chunk 没有按时发出？」</strong> 这是典型的内核评审：不关心补丁从哪来，只关心状态机是否自洽、能否复现。

## 从 v1 到稳定分支：mptcp 那条

更能说明落地情况的是 `mptcp: hold MP_JOIN msk ref when cloning reqsk`。这封补丁的 `Reported-by` 有三个来源：Kyle Zeng（OpenAI）、David Lee（Trail of Bits）、Vega（nebusec.ai）——**三家独立发现同一个 bug**，这在 AI 扫描普及后可能会越来越常见。

它的路径完整走通：经 netdev 的 7.3-rc8 修复批次合并（Jakub Kicinski 署名），随后 Sasha Levin 在 11 月 4—5 日把它回移到 **5.15、6.1、6.6、6.12、6.18** 五个稳定分支；中途 Greg KH 还发出过五封「failed to apply」通知，要求重新回移。最终它出现在 Greg KH 的 6.18.61-rc1 与 7.3.2-rc1 评审批次里。

也就是说，OpenAI 原文里「已发出数百份报告与补丁」这句话，至少**能在邮件列表里被逐条验证**——还能看到它被评审、被合并、被回移的完整链条。

## 「found by an LLM」已经是常规声明

在 lore 上搜这句「The issue was found by an LLM」，能命中 **51 条**结果，来源远不止 OpenAI：`vsock/virtio`、`amt`、`wireguard`、`ocfs2`、`hwmon/coretemp` 等修补里都出现了这句话，部分已经进了 Andrew Morton 的 -mm 树。

方向也反过来：**维护者自己在用 LLM 扫代码**。9 月 24 日，netdev 维护者 Jakub Kicinski 发出一组 `[PATCH net-next 0/3] dpll: fix LLM nit picks from the spec scan`——用 LLM 对着规范扫出的小问题，由维护者自己修。另一个更制度化的痕迹是 `Assisted-by: LLM OpenAI Codex` 这类 trailer，已经出现在进入 stable 的补丁里（例如 smb client 的一个 UAF 修复）。

## AI 审 AI：Sashiko 已经在审每一封 LKML 邮件

半年多前还不存在的一环，现在成了基础设施。**Sashiko**（刺し子）是 Linux 基金会旗下的开源项目（Apache 2.0），自我定位是「智能体化的内核代码评审系统」：它监控公开邮件列表，按多阶段验证流程逐条评估提交的内核改动，并用三层提示结构（对着源码树验证的自动代码笔记、子系统维护者笔记、通用评审流程）来压低误报。该项目明文写着：**这个实例正在评审所有 LKML 提交，算力与 LLM token 由 Google 提供**。

一个细节很能说明当前生态：10 月 30 日 04:21–04:23 的那批 OpenAI 补丁里，`net/rds: Do not unpin a page after a failed atomic pin` 发出后几分钟（04:26），`sashiko-bot@kernel.org` 就在同一线程里给出了机器评审意见。**AI 找到的补丁，先被另一个 AI 审一遍。**

在 Hacker News 上，有人直接问这个交点：作者找到的漏洞里，有多少是 Sashiko 已经抓到过的？团队没有给出数字；一条回复的推理是：「如果 Sashiko 抓到了，这些补丁就进不去了，所以我猜是 0。」——这是猜测，不是数据。

## 维护者的态度：别再造看板，直接把活干完

要理解内核社区怎么接这波，2026 年 7 月 Greg KH 对 **VEGA** 提案的回复是必读材料。VEGA 是一个「类似 syzbot 的 LLM 漏洞工作流」提案（作者 Yuan Tan 称该工具已找出数百个有效 bug），希望建一个公开、可复现、可追踪、去重的平台。Greg KH 的回答基本是拒绝：

- 「我们所有人现在内部系统里都压着几百份报告/补丁，做分诊、排序、协调只会浪费时间。」
- 「syzbot 之所以能搞这套看板，是因为 Google 投了人力，先把严重问题分诊掉。我不觉得别人有这个资源。」
- 「换句话说，<strong>就是硬啃，把补丁发出来，把它们修掉</strong>。我现在就在干这件事，我知道很多人也在干（我这个夏天不知怎么说服了 8 个实习生来帮忙）。」
- 「这会是很漫长的 18 个月……」
- 以及那句带刺的：「也许某家慷慨的公司——正是把这场「地狱（hell）」放到我们头上的那家——会愿意出钱把这件事做掉。就像 Google 当年那样，有先例，但不知为何人们不喜欢吸取历史教训。」

对照来看，OpenAI 这次的做法（按社区建议先修严重问题、与 Patch the Planet 伙伴分批提交、数百份报告与补丁）恰好是「硬啃」路线，而不是再造一个看板。

## 社区的两类质疑

Hacker News 的帖子拿到 **207 分、118 条评论**，其中两支意见最有价值：

**一、948 是「漏洞数」还是「补丁数」？** 有评论质疑这个数字里混着同一漏洞的多个变体。流水线作者在串内回应：这里的计数**按补丁算**，因为补丁生成阶段会做变体分析，一个补丁可能堵住多条利用路径，原始 exploit 数其实更高，为了避免「补丁数 ≠ 利用数」的困惑，报告里取了更小的那个；同时明确范围只在内核，不含以 root 运行的用户态软件。

**二、「这是不是 AI 的功劳」？** 一派认为这些问题人类早就找得到、也早就知道怎么防；另一派反驳「但**不是这个速度和成本**」。还有人指出真正的问题在于：40 多年积累的安全债，现在被一次性摊到桌面上。评论区也提到 Anthropic 的 Glasswing 对 OpenBSD 只报出 1 个漏洞作为对照——<strong>这一说法我们未独立核实</strong>，仅记录为社区讨论。

## 能核实什么，不能核实什么

| 事项 | 核查结果 |
| --- | --- |
| 邮件列表中的 OpenAI 署名补丁 | 可核实：10 月 30 日单账号 3 分钟内 20 封，跨 20 个子系统 |
| 修复是否真的进了上游 | 部分可核实：mptcp 修复进入 7.3-rc 修复批次，并回移 5.15–6.18 稳定分支 |
| 「found by an LLM」的普遍性 | 可核实：lore 上 51 条命中，来自多个团队 |
| Sashiko 是否在审 LKML | 可核实：官方站点自述 + 列表里的 sashiko-bot 回帖 |
| 948 个漏洞的完整清单 | 不可核实：OpenAI 未公开报告与补丁的全量索引 |
| kernelCTF「2026 年接收 26 个」 | 未复核：本轮未找到可独立重算的公开统计 |
| 「10 种新利用技巧」 | 不可核实：原文明确不公开技术细节 |

## 核心总结

- **落地痕迹真实存在**：`kylebot@openai.com` 在 10 月 30 日 04:21–04:23 UTC 连发 20 封内核补丁，此后持续跟进 v2、拆分补丁、回应评审。
- **评审照常严格**：SCTP 维护者 Xin Long 直接质疑补丁的状态机设计并要求提供复现器；补丁里明确写「由 LLM 发现」，但评审只看技术。
- **有修复真正进了内核**：mptcp 的 MP_JOIN 引用计数修复经 netdev 合并，并被回移到 5.15/6.1/6.6/6.12/6.18。
- **三家独立发现同一 bug**：同一封补丁的 Reported-by 同时出现 OpenAI、Trail of Bits 与 nebusec 的人。
- **AI 审 AI 已是常态**：Linux 基金会 Sashiko 正在评审所有 LKML 提交，Google 出算力；OpenAI 的补丁发出三分钟后就被机器评了一遍。
- **维护者的判断是「硬啃」**：Greg KH 反对再建看板，要求直接发补丁修掉，并预估这是「漫长的 18 个月」。
- **数字仍需打折看待**：948 是按补丁计的独立漏洞数，完整清单未公开，kernelCTF 的对照数字也未能独立复核。

## 参考

- OpenAI：[A thousand fewer paths to root](https://openai.com/index/a-thousand-fewer-paths-to-root/)（2026 年 11 月 4 日）
- lore.kernel.org：[`[PATCH net v2] sctp: avoid requeueing pending control chunks`](https://lore.kernel.org/all/20261103192606.92502-1-kylebot@openai.com/)（Kyle Zeng，2026 年 11 月 3 日）
- lore.kernel.org：[Xin Long 对该补丁的评审回复](https://lore.kernel.org/all/CADvbK_d3k8GsgjdHUZ0a2LDs-Y0jd3mxoFvLSnnz3WqCTbBbHA@mail.gmail.com/)（2026 年 11 月 3 日）
- lore.kernel.org：[`kylebot@openai.com` 的全部投递](https://lore.kernel.org/all/?q=kylebot%40openai.com)
- lore.kernel.org：[搜索「The issue was found by an LLM」](https://lore.kernel.org/all/?q=%22found+by+an+LLM%22)
- lore.kernel.org：[Greg KH 对 VEGA 提案的回复](https://lore.kernel.org/all/2026070828-carried-extortion-789e@gregkh/)（2026 年 7 月 8 日）
- Sashiko：[项目介绍](https://sashiko.dev/)；代码仓库：[sashiko-dev/sashiko](https://github.com/sashiko-dev/sashiko)
- Hacker News：[A thousand fewer paths to root 讨论串](https://news.ycombinator.com/item?id=50372929)（207 分，118 条评论）
