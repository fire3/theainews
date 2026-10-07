---
title: "什么是 Codemode：Armin Ronacher 谈智能体外壳侧的编排层"
description: "Armin Ronacher 撰文解释 Codemode：跑在智能体外壳沙箱里、用 JavaScript 组合工具调用的编排层，以及它为何是 bash 之外的必要补充。"
pubDate: 2026-10-07
author: "林晓"
category: "tools"
tags: ["Codemode", "Pi", "MCP", "agent harness", "Armin Ronacher", "QuickJS"]
image: "/covers/2026-10-07-what-is-codemode.jpg"
imageAlt: "封面：浅色杂志编辑风信息图，左栏标题「什么是 Codemode」与「跑在外壳沙箱里，用 JavaScript 组合工具调用」等要点，右栏为外壳沙箱中的代码卡片向外发散箭头、连到工具图标的编排示意"
topStory: false
---

10 月 6 日，Pi 的作者 Armin Ronacher 发表《What is Codemode》，正面回答了一个他自己抛出的问题：既然 bash 就够了，为什么还需要 Codemode？这篇文章既是对他一年多前「不要往上下文里塞工具、用脚本就好」主张的延续，也解释了 Pi 1.0 为何最终通过 Codemode 支持了 MCP。

## 工具的边界，与 bash 的根本限制

Ronacher 先回到工具本身。外壳（harness）给模型提供工具定义，模型是否愿意调用某个工具，是强化学习的结果。他和团队偏爱 CLI 与 bash，原因是它便于组合调用，而且模型在训练中已经学会了文件系统的行为——执行 `echo foo > /tmp/test.txt` 之后，`/tmp` 下就会多出一个 `test.txt`。

但 bash 有一条根本限制：它只能组合<strong>能运行的程序</strong>。有些东西不是程序，却必须以原生工具的形式存在。最明显的例子是 `read` 或 `view_image`：多模态模型要「看」一张图，不能靠 `cat`，因为外壳需要把真正的图像载荷注入到 LLM 的协议里。子智能体（sub agent）是另一个例子——要生成和编排子智能体，很难完全绕开外壳提供的工具；理论上可以用环境变量和 Unix socket 让 CLI 回调外壳，但这很粗糙，而且还牵出另一个问题：代码究竟在哪里运行。

## 大脑与双手

Ronacher 用「大脑与双手」来描述这套结构。大脑是外壳，跑在一台机器上，是被信任的；双手是工具真正执行的地方，Pi 里叫<strong>执行环境（execution environment）</strong>，它常常是同一台机器，但概念上是所有操作的目标。

对 Pi 而言，关键的一点是：<strong>外壳大脑与执行 bash、跑工具的目标环境之间存在一条分界线</strong>。把两者拆开有很实际的后果——它们运行在不同的文件系统上，也有不同的信任级别。比如使用 Gondolin 这类沙箱方案时，bash 一侧会被妥善沙箱化，但外壳本身不在沙箱内。

## Codemode 做什么

Codemode 正是让 LLM 在<strong>外壳一侧</strong>（而非执行环境一侧）表达和编排复杂操作的方式。它运行在外壳自己的沙箱里：在 Pi 中，它是一个跑在 WASM 运行时的 QuickJS，被刻意限制了能力——没有网络、没有文件系统、没有定时器、内存有限，唯一出路就是调用更多工具。Ronacher 补充说，同样的思路也可以换成 Scheme 之类的语言。

Codemode 这个名字来自 Cloudflare。它的核心是从某种编程语言里发起工具调用，从而<strong>不必经过 LLM 上下文</strong>就能组合这些调用。与普通工具调用的差别体现在几处：

- <strong>输出不再被截断</strong>：普通 bash 调用只把尾部约 2000 行塞进上下文，不够就得让智能体自己去看溢出文件；经由 Codemode 发起时，更大的输出会<strong>结构化地</strong>返回给脚本。
- <strong>可以表达并发与工作流</strong>：因为宿主语言是 JavaScript，智能体可以用 `Promise.all` 并发处理。常见用法是先探测某类工具返回的 5 到 10 条数据看清结构，再写一段脚本批量处理后续条目。Pi 自己把并发工具执行限制在 4 个，超出的排队，所以 `Promise.all` 是安全的。
- <strong>可以把状态写进 transcript</strong>：一次 Codemode 调用可以用 `store()` 存下数据，会话里下一次调用再 `load()` 回来——注意这份状态在外壳主机上，不在沙箱里。
- <strong>能触达不适合做成工具的能力</strong>：图像生成、用 Jev 这类分类模型做一次性分类，在传统界面里没有合适的位置，暴露成工具只会白占上下文，但在 Codemode 里可以直接调用内部模型 API。

启用方面，Codemode 默认只在开启 MCP 时启用，也可以通过设置里的 `"defaultTools": ["+codemode"]` 打开。

## 几个真实会话里的用法

Ronacher 贴出了几段来自真实 Pi 会话的代码，都是模型自己写的。最直接的一段是生成图像：用 `models.getAvailableOfType("image")` 拿到图像模型，`models.generateImages()` 生成后，再把结果里的图像块交给 `image()` 回传给模型——外壳会同时把它落盘为临时产物，方便智能体之后交给 bash 使用。

第二段用分类模型 Jev 批量处理 GitHub issue：先 `gh issue list` 取回 100 个 issue，再用 `Promise.all` 对每个 issue 并行调用 `models.classify()`，同时问出<strong>情绪倾向</strong>、<strong>挫败感评分</strong>和<strong>类型</strong>三个问题，最后用 `store("sentiment_results", results)` 把结果留在会话里，并按挫败感倒序返回前 12 条。

第三段更激进：让 Jev 驱动游戏引擎来调试。模型自己摸清了作者的 `tankctl` 命令，围绕它搭了一个 30 步循环——每一步先从游戏引擎取一份状态文本，再交给 Jev 决定下一步动作（攻击、接近、闪避还是吃道具），然后由脚本把动作翻译成具体指令执行。

最后是 MCP。因为 Pi 并不把 MCP 工具直接暴露给 LLM，智能体要先在 Codemode 里做工具搜索来发现能力，这种<strong>渐进式发现</strong>让 MCP 在很多场景下够用。示例中，智能体直接调用了 Sentry MCP 的 `find_organizations` 和 `find_projects`——它并非凭空猜出工具名，而是从系统提示词里得知该服务器可用。

## MCP 的现实问题

Ronacher 说 MCP 是一个「极大受益于 Codemode 的协议」，问题在于它眼下往往面向尚未使用 Codemode 的外壳。Cloudflare 的临时做法是把 Codemode 塞进 MCP 服务器内部，结果形成「Codemode 套 Codemode」：双重 JSON 转义、小模型容易糊涂，而且内层代码无法调用外层的工具。

他给出四条改进建议：

- <strong>结构化内容</strong>：Codemode 希望调用返回格式良好的 JSON，MCP 的 `outputSchema` 正合此意。
- <strong>结果一致性</strong>：有些服务器会按结果条数做 token 优化，导致先探测 5 条能成功、批量到上限时反而失败。
- <strong>大体积二进制数据</strong>：MCP 目前还不支持，很多有意思的用例只能靠预签名 URL 之类的绕路方案。
- <strong>可组合的工具搜索</strong>：服务器或许比客户端更清楚哪个工具合适，但目前没有机制让外壳跨多个 MCP 服务器分发工具搜索。

## 这不是反转

Codemode 是否推翻了 Ronacher 一年前力挺 CLI 的立场？他认为不是。在他看来，MCP 生态恰好走上了他们一年前指出的那条路——代码；而 Codemode 比 MCP 更进一步，它在外壳内部为智能体提供了更强的表达自由。

仍未解决的问题也很明确：一是<strong>持久性（durability）</strong>更棘手，可能得借鉴持久化工作流引擎的思路为调用做快照，或者干脆换用 Starlark 这类具有确定性语义的语言；二是图像与二进制数据，以及这套模式对较小模型并不友好，都还需要继续打磨。Ronacher 的结论是：这不是个完美方案，但相当有用，值得更多地用起来。

## 核心总结

- <strong>问题起点</strong>：bash 只能组合能运行的程序，而 `read`、`view_image`、子智能体这类能力必须由外壳原生提供，且代码运行位置需要区分
- <strong>结构区分</strong>：外壳是「大脑」，可信、在沙箱之外；执行环境是「双手」，两者文件系统与信任级别不同
- <strong>Codemode 定位</strong>：跑在外壳侧沙箱（Pi 用 WASM 里的 QuickJS，无网络/文件系统/定时器）的编排层，用 JavaScript 组合工具调用，不必经过 LLM 上下文
- <strong>实际收益</strong>：结构化大输出、并发工作流、用 `store()`/`load()` 把状态写进 transcript、直接调用图像与分类模型
- <strong>MCP</strong>：Codemode 让 MCP 变得可用（渐进式工具发现），但「Codemode 套 Codemode」很别扭；需要结构化内容、结果一致性、大二进制支持与可组合的工具搜索
- <strong>未解问题</strong>：持久化更难（可能借鉴工作流引擎或改用 Starlark）、图像与二进制数据、小模型能力不足

原文：[What is Codemode](https://lucumr.pocoo.org/2026/10/6/codemode/)（Armin Ronacher's Thoughts and Writings，2026-10-06）
