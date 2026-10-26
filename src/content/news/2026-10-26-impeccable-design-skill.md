---
title: "Impeccable：把设计总监装进编程智能体，用 24 条命令和 62 条规则治「AI 味」"
description: "8.8 万 star 的开源设计技能 Impeccable：24 条命令、62 条确定性检测规则、浏览器里实时改稿，让编程智能体摆脱同一套 AI 设计模板。"
pubDate: 2026-10-26
author: "林晓"
category: "tools"
tags: ["Impeccable", "设计技能", "Claude Code", "Cursor", "Codex", "AI slop", "检测规则", "Rust", "开源"]
image: "/covers/2026-10-26-impeccable.jpg"
imageAlt: "封面：近黑底极简杂志风，上方白色超大英文标题「Impeccable」，一条酸橙绿细线下方是酸橙绿超大数字「62」，再往下是白色中文「条确定性设计规则」与浅灰小字「24 条命令 · 8.8 万 star · 不调用模型」"
topStory: true
---

一个 11 个月前建立的开源仓库，如今有 <strong>8.85 万 star、5,283 fork、61 位贡献者</strong>，Apache-2.0 许可，npm 上周下载 16.7 万次。它不发模型、不做编辑器，只给编程智能体一份「设计技能」：24 条命令、62 条确定性检测规则，外加一个能在浏览器里挑元素、生成变体的实时模式。

这就是 <strong>Impeccable</strong>。作者 Paul Bakaus 是 jQuery UI 的创造者，目前仍在 Google 工作。项目最新技能版本为 4.7.0（10 月 19 日发布），负责检测与本地服务的引擎为 0.1.17（10 月 23 日）。

## 起点：所有模型都长着同一张脸

Impeccable 的 README 把动机写得很坦白：Anthropic 的 frontend-design 是第一个被广泛使用的 Claude 设计技能，Impeccable 从它出发。但「每个模型都在同一批 SaaS 模板上训练过」——不加引导，产出就会反复出现同一组痕迹：所有地方都用 Inter、紫到蓝的渐变、卡片里再套卡片、彩色背景上的灰字、每个标题上方都摆一块圆角图标方块。

它的解法不是再塞一堆风格形容词，而是给智能体一套可以执行的设计流程与词汇：一个安装入口、一组命令、一套可被检查的规则。

## 一个技能，24 条命令

安装只需要在项目根目录执行 `npx impeccable install`，然后在智能体里运行 `/impeccable init`（Codex 用 `$impeccable`）。`init` 会把受众、目的、运行环境、约束、语气与证据写进 <strong>PRODUCT.md</strong>，避免后续命令把产品事实和视觉方向混为一谈；`document` 则从现有代码生成 <strong>DESIGN.md</strong>，记录颜色、字体、布局规则与组件；每个页面或路由还可以有一份 surface brief，保存这一屏的策略与方向。

命令按用途分组，覆盖从规划到收尾的整条链路：

| 类别 | 代表命令 | 作用 |
| --- | --- | --- |
| 构建 | `shape`、`init`、`document`、`extract` | 先规划 UX/UI，记录产品与视觉上下文 |
| 评估 | `critique`、`audit` | 设计评审、可访问性与响应式检查 |
| 精修 | `polish`、`bolder`、`quieter`、`distill` | 收尾、加强、收敛、做减法 |
| 增强 | `animate`、`colorize`、`typeset`、`layout`、`delight`、`overdrive` | 动效、配色、字体、版式与「惊喜时刻」 |
| 修复 | `harden`、`clarify`、`adapt`、`optimize` | 边界情况、文案、适配与性能 |
| 迭代 | `live`、`generate` | 在浏览器里对比变体并采纳 |

还有一个容易被忽略的设计：它把界面分成四种<strong>模式</strong>——Persuade（说服，落地页与营销）、Operate（操作，应用与后台）、Read（阅读，文档与文章）、Experience（体验，作品集与画廊）。同样的「大胆」在落地页是加分，在设置页就是噪音；模式决定了野心该以什么形式出现。

## 「发牌」：把品味拆成可对比的选项

新页面或更换视觉方向时，Impeccable 会在本地跑一个 `concept-seed` 脚本。它先从受众的文化世界里列出七个具体的视觉系统（避开品类默认与它们的反面），再由脚本<strong>掷骰分配</strong>一个方向，并额外发几张「挑战者」卡。随后本地起一个决策页，把卡片以同等分量呈现，用户可以重掷，分普通、更安全、更大胆三档。

流程里有几条硬规则值得记下：

- 落选的方向不能直接丢掉，必须说明「从它身上拿了哪一条纪律」——例如配色的彻底程度、网格的密度勇气——但不能借它的「衣服」；
- 每个方向要写成一份 direction contract，包含论点、自有世界的配色与组件语言、叙事、首屏构图与完成标准；
- 构建分两条路：<strong>comp-led</strong> 先用图像模型出高保真 mockup 再照着实现，<strong>code-led</strong> 直接在代码里写方向契约。前者上限更高但要多轮迭代，后者第一版更稳。
- 完工必须经过 finish review，并把建成的世界写回 DESIGN.md 与 `design.json`。

这套流程的目的很明确：打破「每次生成都收敛到同一个默认审美」的排名惯性，把审美决定变成用户看得见、可以选的几张牌。

## 62 条确定性规则：不调用模型

Impeccable 的另一半是一个 Rust 写的检测引擎。它不在对话里跑，而是一个自包含的二进制：技能目录里带启动器，首次运行时下载到 `~/.impeccable/bin/`，也按平台发布成 npm 可选依赖。

```bash
npx impeccable detect src/                 # 扫源码目录
npx impeccable detect https://example.com  # 扫渲染后的页面（用本机 Chrome）
npx impeccable detect --json .             # 供 CI 使用的 JSON
npx impeccable detect --github src/        # GitHub Actions 注解
```

62 条规则分成两类：一类针对 AI slop——侧边色条卡片、紫蓝渐变、弹跳缓动、暗色辉光；另一类是一般设计质量——行宽过长、内边距局促、触控目标过小、跳级标题、对比度不足。退出码有明确语义：0 表示无主要问题，2 表示发现问题，1 表示有目标无法扫描。

因为不依赖模型与 API key，这套检查可以进 CI，也可以在编辑时实时跑。Claude Code、Cursor、Codex、GitHub Copilot 与 Grok Build 上，安装器会写入各家的原生钩子：智能体改完 UI 文件后自动扫描，把发现送回对话；可以按规则、按文件、甚至按单行注释记录例外，避免「品牌字体就是 Inter」这类误报。

## 实时模式与工具覆盖

`/impeccable live` 是 beta 功能：打开本地站点，选中页面元素、描述想要的改动，默认生成三个变体在页面内切换对比，满意就接到源码里；`Steer` 还能给出整页级的方向。官方明确它只用于本地开发服务器，不支持下注到生产站点，也不建议为此关闭浏览器安全策略。

接入面铺得很广：Claude Code、Cursor、Codex CLI、Gemini CLI、GitHub Copilot、Grok Build、Antigravity、OpenCode、Pi、Hermes Agent、Kiro、Trae、Rovo Dev、Qoder、Devin、DeepSeek Harness 等近二十种工具，另有 VS Code 扩展、Claude Code 插件市场与 git submodule 三种分发方式。项目文档称，GitHub Copilot 应用里已内置 Impeccable，在 Settings → Experimental 打开即可。

## 争议：设计能被规则化吗

2026 年 1 月 Impeccable 首次登上 Hacker News（103 分、64 条评论）时，最尖锐的批评集中在 before/after 示例：不少读者认为「after」更差——注册表单被塞进大段营销文案，仪表盘把信息密度换成了留白。作者在帖中逐条回应，承认示例是赶工之作、已撤下，随后重做了站点与案例。

更深一层的质疑是：设计词汇只是表层，真正的设计是理解用户会如何反应，不是把「垂直节奏」这类词喂给模型。Impeccable 后来的工程化回答是：用 62 条规则兜住已知的坏品味，用「发牌」流程逼出不一样的方向，再用渲染后的页面与真实视口来验收。规则能拦住见过的错误，但拦不住还没有人做过的判断——这部分仍然留给人。

## 核心总结

- <strong>项目</strong>：Paul Bakaus 发起的开源设计技能，Apache-2.0，2025 年 11 月建立；截至发稿 8.85 万 star、5,283 fork、61 位贡献者，npm 周下载 16.7 万次
- <strong>版本</strong>：技能 4.7.0（2026-10-19）、检测引擎 0.1.17（2026-10-23）；仓库以 Rust 写引擎，技能本体是 Markdown
- <strong>命令</strong>：24 条命令覆盖规划、评审、精修、增强、修复与浏览器迭代；`init` 写 PRODUCT.md，`document` 写 DESIGN.md
- <strong>流程</strong>：`concept-seed` 掷骰发牌、本地决策页对比、支持三档重掷；选定后写方向契约，再走 comp-led 或 code-led 构建
- <strong>检测</strong>：62 条确定性规则，Rust 二进制，不调用 LLM、不需要 API key；可扫源码或 URL，输出 JSON 与 GitHub Actions 注解
- <strong>集成</strong>：原生钩子覆盖 Claude Code、Cursor、Codex、Copilot、Grok Build，另支持近二十种智能体工具与 VS Code 扩展
- <strong>争议</strong>：首发时的 before/after 示例被批评「越改越差」，作者已撤下重做；「设计能否被规则化」仍是开放问题

原文：[pbakaus/impeccable](https://github.com/pbakaus/impeccable)（GitHub，Apache-2.0）

参考：

- [Impeccable 官网](https://impeccable.style/) 与 [文档](https://impeccable.style/docs/)
- [Slop 目录：AI 设计惯性与检测示例](https://impeccable.style/slop/)
- [Run a detector scan](https://impeccable.style/docs/detector)（Impeccable Docs）
- [New visual work](https://github.com/pbakaus/impeccable/blob/main/skill/reference/new-work.md)（技能参考文档）
- [skill-v4.7.0 发布说明](https://github.com/pbakaus/impeccable/releases/tag/skill-v4.7.0)（2026-10-19）
- [Impeccable Style（Hacker News 讨论）](https://news.ycombinator.com/item?id=46587284)（2026-01-12）
