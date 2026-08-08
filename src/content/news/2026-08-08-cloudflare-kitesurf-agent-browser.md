---
title: "Cloudflare 发布 Kitesurf：跑在 Workers 上的智能体专用浏览器"
description: "Cloudflare 推出 Kitesurf——完全运行在 Cloudflare Workers 上的智能体优先浏览器：原生 Rust 编译到 Wasm，通过 Dynamic Workers 隔离，已通过 21.5 万项 WPT 测试，CPU/内存比 Chromium 省 3-7 倍。"
pubDate: 2026-08-08
author: "林晓"
category: "tools"
tags: ["Cloudflare", "Kitesurf", "AI 智能体", "浏览器", "WebAssembly", "Workers"]
---

8 月 6 日，Cloudflare 正式发布 **Kitesurf**——一个完全跑在 Cloudflare Workers 上的「智能体优先」浏览器，上线即免费（beta 期），集成在 Browser Run 里。它的核心主张很直接：浏览器引擎是为人类设计的，不是为 AI 设计的；而这个跑在 Wasm 隔离环境里的轻量引擎，正是为 token 数、上下文窗口、可扩展性和成本这些 AI 真正在意的东西而生。

这件事的起点，是 Cloudflare 内部问了多年的老问题：**我们要不要自己做浏览器？**——答案是，这次终于做了。

## 为什么 AI 需要一个新浏览器

现有浏览器引擎（比如 Chromium）是为人类使用习惯打造的，随之而来的是 AI 根本用不上的开销。代理要执行很多任务都离不开浏览器，但让每个 agent 独享一个 Chromium 实例，内存和算力消耗高得吓人，把大量网页访问锁死在了昂贵的高参数模型手里。

Kitesurf 的思路是反过来：给智能体一个**在 AI 关键维度上做到极致**的浏览器，哪怕牺牲那些对人类有用、对 AI 无所谓的特性。AI 不在乎标签页、主题、扩展、跨设备同步——它在乎 token 数、上下文窗口、伸缩性、性能与成本；结构化、机器可读的内容很重要，像素级完美的渲染不重要；CSS 解析略有偏差、渲染不够完美，agent 完全没问题。

风险模型也完全不同。在 AI 用浏览器的语境下，**提示注入（prompt injection）和工具安全**成了头等大事。

## 设计决策：测试、Wasm、异常处理与隔离

从原型走向能扛生产负载的浏览器，Cloudflare 分享了四条贯穿始终的设计原则。

- **用测试驱动 AI 开发**：项目的进阶高度依赖 AI 加速。他们以 Web Platform Tests（WPT）——W3C 合规测试套件——作为给 AI agent 的「成绩标准」，人工负责挑选和排定功能顺序、审阅 agent 的实现。WPT 只管标准合规，不管真实网页渲染，于是又叠加了集成测试 + 视觉回归测试：用 Puppeteer 在真实网站上同时跑 Chromium 和 Kitesurf，不仅对比断言，还逐步对比渲染输出。

- **能用 Rust 就用 Rust**：直接以原生 Rust 用 wasm-bindgen 编译到 WebAssembly，避免 Emscripten 那种有多层模拟依赖的笨重二进制，尽可能贴近底层、可靠运行。

- **异常处理即生存机制**：浏览器必须渲染完整张不可靠甚至恶意的网页而不丢页。原则是——**任何失败都降级为空白帧或缺失元素，绝不变成死会话**。在每处边界捕获异常，默认返回安全空值，并记录足够日志。

- **全隔离、尽量无状态**：agent 被指向的是任意来源的任意代码，所以假设**每次页面加载都是不可信输入、每个会话都从零开始**。每个组件只访问它严格必需的资源。能做成无状态的组件就做成无状态的——崩溃恢复就是重启重放请求，天然适合突发型的自动化负载。

## 三大组件：Engine、PageScript、PageRenderer

Kitesurf 的一次请求生命周期由三个主要组件完成。

**Engine** 是唯一对外公开的组件，负责 CDP WebSocket 和 HTTP REST API、以及会话状态存储，其余组件全部无状态。它兼容 Chrome DevTools Protocol，所以 Puppeteer、Playwright、chrome-remote-interface 乃至 Chrome DevTools 前端，指过去就能直接用——这也是 Browser Run 的接入方式。

**PageScript** 是 Dynamic Workers 威力的体现。每个新页面或进程外 iframe（OOPIF）都用 Dynamic Workers 拉起一个长生命周期 PageScript 隔离环境，内含干净的 globalThis 和 DOM 对象。HTML 与 CSS 的解析复用 Blitz（模块化渲染引擎）和 Stylo（Firefox 的高性能 CSS 解析器），均以 Rust 编写。至于 `eval`——出于安全考量 Workers 原生不支持，就用 Rust 编写的 ECMAScript 引擎 Boa JS 在运行时之上再跑一个运行时来兜底，等原生 eval 落地后再迁移。

**PageRenderer** 负责把计算出的页面对象真正画成像素。它和 Engine 循环协作：Engine 需要一帧时，PageRenderer 从 PageScript 拿页面对象（scene），从静态资源取字体和图片，光栅化成图像缓冲再返回给客户端显示成 JPEG/PNG/PDF。这里用到 Blitz 的 blitz-paint 模块，再由 Parley 负责字形排版、选字体、断行。

设计上很巧的一点是**网络访问的收敛**：渲染不可信页面要抓任意资源（图片、字体、CSS、JS、Wasm），这是浏览器最危险的操作之一。Kitesurf 让这一切只经过一个 SandboxOutbound worker——由 Dynamic Workers 强制唯一能碰网络的组件，用它强制 CORS、注入浏览器形状的请求头、过滤响应、给每个页面独立的 cookie jar，不合策略一律 403。

跨组件的通信靠 Workers 内置的 RPC——Engine 用一次 `renderFrame()` 调用从 PageRenderer 拿到 PNG，无需关心 API schema、类型或鉴权。因为渲染器不持有页面状态，Engine 可以在任何失败或卡住的 RPC 上安全地杀掉并重启它。

## 现状：21.5 万项 WPT 测试 + 可观的性能

Kitesurf 目前**已经通过 21.5 万+ 项 WPT 测试**，而且每周还在新增数百项。对 agent 最重要的部分——CSS、DOM、HTML、选择器、SVG、XHR——覆盖率已经不错，连对 agent 不那么要紧的流（streams）也有了一定支持。

性能上，在 5 次 Browser Run 快捷操作、14 个 URL 语料的中位数对比中，Kitesurf 相对 Chromium（暖池）的表现如下：

| 指标 | Kitesurf | Chromium | 相对差距 |
|---|---|---|---|
| CPU：截图 | 380 ms | 1,173 ms | 省 3.1× |
| CPU：HTML 提取 | 229 ms | 877 ms | 省 3.8× |
| 内存：截图 | 57.8 MiB | 271 MiB | 省 4.7× |
| 内存：HTML 提取 | 39.4 MiB | 273.7 MiB | 省 7.0× |
| 墙钟：截图 | 1,148 ms | 637 ms | 慢 1.8× |
| 墙钟：HTML 提取 | 820 ms | 472 ms | 慢 1.7× |

Chromium 在「秒表」上仍占优——因为跑过热页面的 JIT 总是比冷启动的软件渲染器快，目前差距约 1.7 倍，大部分来自光栅化和 JPEG/PNG 编码，团队会继续优化。但 Kitesurf 在**真正驱动账单的内存和 CPU 上，比 Chromium 省 3–7 倍**——更少的内存意味着能同时跑更多会话、更好扩展，同时压低双方成本。

当然，最重要的测试莫过于：**Kitesurf 能跑 Doom**。

## 现在就试试

Kitesurf 已随 Browser Run 免费开放（beta，受账户级配额限制）。Browser Run 的 CDP 端点现已支持 Kitesurf，只需在端点加上 `browser=kitesurf` 参数：现有的 Puppeteer、Playwright、chrome-remote-interface，以及任何会说 MCP/CDP 的 AI agent，都能直接用。也可配合 Browser Run 的 Quick Actions，一条 curl 就能截图或提取内容。想要可视化探索，则有集成 Chrome DevTools 的公开 playground，还能通过 Memory 面板查看每个隔离环境的 WebAssembly 内存占用。

**什么时候该用 Kitesurf**：需要渲染页面、且能接受不用完整像素级 Chromium 的 AI agent；以及依赖一次性 Quick Actions 的自动化应用，比如页面内容提取、生成 PDF 或截图。它就像一个只为任务存续期间而存在的、完全隔离、无状态的临时引擎，天然适合突发型 AI 负载。

**什么场景还不行**：播放视频、WebGL 渲染、带真实 TLS 指纹的 bot-challenge 握手，或需要持久状态的十分钟认证会话——这些仍该用 Browser Run 默认的 Chromium。目前 Kitesurf 已能正确渲染 TodoMVC（vanilla/React/Vue/Angular/Preact）、Wikipedia、Hacker News、Cloudflare Blog 和大部分 Cloudflare 控制台。

## 往哪走

Kitesurf 才 12 周大，首个 commit 来自 5 月。团队正在推进：更完整的 CDP 覆盖、截图和 PDF 的渲染保真度（因为 LLM 往往从图像而非底层文本工作得更好）、更多 WPT 覆盖，以及持续的 CPU/内存/墙钟效率优化。

最后值得一提：**Cloudflare 计划在准备好后开源 Kitesurf**，目标是让任何客户都能在自己账户里部署自己的版本。想尝鲜就上 playground，盯 changelog，加 Discord 反馈——团队说，他们听着。

## 核心总结

- **新品**：Cloudflare 发布智能体优先浏览器 Kitesurf，完全跑在 Cloudflare Workers 之上，beta 期免费可用
- **为 AI 而生**：不在乎标签页/扩展/像素完美，在乎 token、上下文、性能与成本；把提示注入和工具安全放在首位
- **技术底座**：原生 Rust 编译到 Wasm，Dynamic Workers 实现每页隔离，组件尽量无状态，所有网络访问收敛到唯一出口
- **数据说话**：已通过 21.5 万+ 项 WPT 测试，CPU/内存比 Chromium 省 3–7 倍
- **怎么用**：Browser Run 端点加 `browser=kitesurf`，现有 CDP/MCP 客户端无需改动即可接入
- **路线图**：持续提升兼容性与效率，计划开源

这篇文章最值得注意的，是它回答了一个此前几乎没人认真追问过的问题：当浏览器不是为了人、而是为了 AI 而存在时，它应该长成什么样。Kitesurf 用「隔离、无状态、可伸缩、为 token 优化」给出了一个具体答案，也顺手把工作量证明——跑通 Doom——给交了。

原文：[Introducing Kitesurf: The agent-first browser that runs in V8 isolates on Cloudflare Workers](https://blog.cloudflare.com/kitesurf/)（Cloudflare）
