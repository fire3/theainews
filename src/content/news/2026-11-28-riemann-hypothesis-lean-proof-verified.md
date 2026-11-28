---
title: "黎曼猜想 7.6 万行 Lean 证明通过独立验证：机器零拒绝，人类还没读懂"
description: "MIT、滑铁卢与 Sonoda 独立复核后确认，紧凑版 7.6 万行 Lean 证明 794 个模块零拒绝、六个内核全部接受；但至今没有同行评审论文，数学家仍在读代码。"
pubDate: 2026-11-28
author: "林晓"
category: "research"
tags: ["黎曼猜想", "Lean", "形式化验证", "Anthropic", "Claude", "Mathlib", "千禧年难题"]
image: "/covers/2026-11-28-riemann-hypothesis-lean-proof-verified.jpg"
imageAlt: "封面：冷色学术风坐标图，零点点亮在一条竖直蓝线上，左侧标题「黎曼猜想，机器通过了」"
topStory: true
---

11 月 26 日，MIT 数学家 Andrew Sutherland 与滑铁卢大学 Michael Rubinstein 团队、日本学者 Sho Sonoda 先后完成了对黎曼猜想「紧凑版」证明的独立复核：794 个 Lean 模块全部编译通过、逐个内核重放全部接受、零拒绝；证明只用到 Lean 的三条标准公理，五个主定理的陈述与 Mathlib 的原始表述逐字一致。第二天，Sutherland 又追加报告，称偏执模式（paranoid）的端到端比对还通过了黎曼猜想与 Schoenfeld 显式算术界之间的等价关系，以及该算术界本身。

这一切的起点是 11 月 20 日。Anthropic 数学家 Levent Alpöge 在个人网站发布一份四页说明和一个 14 段的 Lean 归档，写下那句后来被反复引用的话：「我相信，在与 Claude 的合作下，我发现了黎曼猜想的证明。」次日 13:55 UTC，Lean FRO 与 Mathlib Initiative 联合发表声明：「我们特此认证，黎曼猜想的陈述与证明均为正确。」从 1859 年黎曼写下那句话算起，已经过去 167 年。

## 从 1740 万行压到 7.6 万行

原始归档有 175,187 个 Lean 文件、17,374,215 行代码，编译一次要十几到二十小时，导出文件达 61.57 GB。Alpöge 自己并不讳言它的粗糙，11 月 23 日他在 X 上写「Lean 代码显然充斥着垃圾内容，但它确实能编译通过」，并澄清「25 万页只是个玩笑」。

真正的转折在 11 月 25 日。Anthropic 研究员 Luke Sernau 与同事、以及 Claude，把原证明重写成两个版本：可读版约 30 万行、803 个模块，紧凑版约 7.6 万行、794 个模块，压缩幅度超过 99.5%，却证明了完全相同的五个主定理。仓库 README 给出的构建条件是 Lean v4.35.0 与 Mathlib 提交 `56a00585`，在 12 核、24 GB 内存的机器上带 Mathlib 缓存约需一到两小时——这是普通办公电脑可以承受的量级。

## 验证验的到底是什么

这场验证的说服力不在「跑通了」，而在于它把「跑通了」拆成了四个可以分别攻击的问题。

第一，陈述必须保真。比对工具（Comparator）与两个独立实现 con-leche、con-ron 确认，代码证明的定理就是 Mathlib 里那个 `riemannHypothesis`，而不是一个伪装成它的弱命题。第二，代码必须无错编译：794 个模块全部通过，导出结果在两台机器上逐字节一致。第三，公理必须干净：只出现 `propext`、`Classical.choice`、`Quot.sound` 三条，没有 `sorry`、`axiom`、`native_decide` 之类的取巧。第四，内核必须重放：Lean 默认内核、`leanchecker`、`lean4lean`、Rust 写的 nanoda、con-leche、con-ron 六个检查器各自独立判定，全部接受。

![RH Lean Explorer 把 Sernau 可读版证明映射成知识图谱：29 个主题分组、803 个文件、1,733 条文件间引用](/images/2026-11-28-riemann-lean/lean-explorer-map.png)

*图：RH Lean Explorer 将可读版证明按主题分组可视化，可逐文件查看引用关系。（来源：RH Lean Explorer）*

按新智元援引 MIT 验证页的统计，仅追加的 Schoenfeld 等价关系这一步就涉及 206,292 项声明，端到端耗时约 2 小时 26 分，六种检查器全部通过。

![新智元在 X 上给出的 MIT 复核数据：206,292 项声明、2 小时 26 分、6 种检查器全部通过](/images/2026-11-28-riemann-lean/mit-check-summary.png)

*图：新智元发布的复核摘要，称 MIT 的 Sutherland 从源码端到端验证了 Schoenfeld 界及其与黎曼猜想的等价关系。（来源：新智元）*

值得注意的是执行方式本身：Sutherland 与 Rubinstein 的复核都用 Claude Code 运行，那个等价关系项目的代码也是由 AI Agent 写的，只经过了机器检查。换句话说，这一轮「人类验证 AI 证明」的工作，很大一部分又交回给了 AI。

![滑铁卢团队复核页：794 个模块全部编译，内核重放 794 项全部接受、零拒绝](/images/2026-11-28-riemann-lean/waterloo-checklist.jpg)

*图：滑铁卢团队的复核清单，末尾一项即 `lake comparator --paranoid`：陈述、公理与六个内核一并校验。（来源：Michael Rubinstein 团队复核页）*

## Clay 的标签从 Unsolved 变成 Active，奖金还悬着

11 月 21 日，克莱数学研究所的黎曼猜想页面还标着「Unsolved」；到 23 日 19:15 UTC，标签变成了「Active」。这个措辞变化很能说明当前的处境：机器已经给出判定，机构还没有给出裁决。

千禧年奖的规则要求证明发表在符合条件的期刊、发表后满两年、并获得数学界的普遍接受。截至目前，没有任何同行评审论文的消息，Alpöge 的四页说明是唯一的文字交代，他本人表示「打算好好写出来」。这也是理解这件事最关键的一层：<strong>「确认一个定理为真」和「理解它为什么为真」是两件事</strong>。

## 数学家在接受结论，同时在抱怨可读性

Sutherland 的评价相当直接：「老实说，这里面有任何猫腻的概率约等于零。」Scott Aaronson 在博客里写「这个证明是正确的」，但补了一句：数学家只有在「能够自己解释、提炼、重建这些想法」时才会真正满意。

怀疑集中在别处。Imperial College 的 Kevin Buzzard 说：「目前我们甚至不知道这个定理为什么成立。」NYU 的 Maksym Radziwiłł 更不客气：「数学和其余科学一样，真正的问题是『为什么』，而这完全没有回答。」蒙特利尔大学的 Andrew Granville 则直指文本：「他发布的东西是混乱的。」11 月 20 日，Association for Human Mathematics 在联合声明之前就发过一份批评，称「没有任何数学家能完全确定这个证明是正确的」。

还有一篇 J. L. Nielsen 的预印本承认代码能通过类型检查，但主张其中的几何部分是「人造的见证物」。验证方的回应是：定理用的是 Mathlib 自己的黎曼猜想定义，且被两个独立工具比对过，证明内部的任何定义都无法让检查器接受一个错误的陈述。

为消化这份证明，Anurag Sahay、Will Sawin 与 Lior Silberman 已提议发起 G.R.H. Polymath 项目，参照 Polymath 模式组织全球数学家分工拆解，目标是产出可读的黎曼猜想与 Dirichlet 广义黎曼猜想论述。菲尔兹奖得主 James Maynard 预计「这个证明最终会被证明是正确的」；丘成桐则估计，把这堆代码吃透、写成人类能读的论文，最多不超过五年。

## 核心总结

- **事件**：2026 年 11 月 20 日 Alpöge 发布黎曼猜想与 Dirichlet GRH 的 Lean-only 证明，21 日 Lean FRO 与 Mathlib Initiative 联合认证，26 日 MIT、滑铁卢、Sonoda 完成对 7.6 万行紧凑版的独立复核。
- **规模**：原始 175,187 个文件、约 1,740 万行；Sernau 版压到可读版约 30 万行（803 模块）与紧凑版约 7.6 万行（794 模块），压缩 99.5% 以上，五个主定理不变。
- **强度**：794/794 模块编译通过，六个独立内核零拒绝，声明比对与公理审计通过，只依赖 Lean 三条标准公理。
- **边界**：没有任何同行评审论文，Clay 奖金规则未满足，页面标签仅从「Unsolved」变为「Active」；人类对证明思想的理解仍待 Polymath 式协作。
- **方式**：证明由 Claude 参与产出，重塑与复核也大量使用 Claude Code，等价关系代码由 AI Agent 编写、仅经机器检查。

参考：

- [Riemann hypothesis timeline: 1748 to the 2026 Lean proof](https://riemannhypothesissolved.com/timeline/)（RH Lean Explorer，2026 年 11 月 28 日更新）
- [Status of the proof](https://riemannhypothesissolved.com/status/)（RH Lean Explorer）
- [lsernau/grh-lean: GRH for Dirichlet L-functions, in Lean 4](https://github.com/lsernau/grh-lean)（Luke Sernau，Apache 2.0）
- 原文：[黎曼猜想压缩成功！MIT全票通过：7.6万行紧凑证明无误](https://mp.weixin.qq.com/s/ZIEcKVicH75NmmVUCaYumg)（新智元，2026 年 11 月 28 日）
