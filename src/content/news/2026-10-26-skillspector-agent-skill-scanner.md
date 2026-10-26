---
title: "NVIDIA 开源 SkillSpector：安装智能体技能之前，先做一次安全体检"
description: "NVIDIA 开源技能安全扫描器 SkillSpector：71 条检测规则、静态分析加可选 LLM 语义复核、0-100 风险分；论文测得 26.1% 的技能至少含一个漏洞。"
pubDate: 2026-10-26
author: "林晓"
category: "tools"
tags: ["SkillSpector", "NVIDIA", "智能体技能", "安全扫描", "提示词注入", "MCP", "供应链安全", "开源"]
image: "/covers/2026-10-26-skillspector.jpg"
imageAlt: "封面：浅色杂志编辑风，纯白底与右侧浅灰面板；左侧依次为近黑超大英文标题「SkillSpector」、中文标题「装技能之前，先扫一遍」、珊瑚橙点缀的副标题「NVIDIA · 71 条规则 · 26.1% 技能有漏洞」，以及三条要点「静态分析 + 可选语义复核」「0 到 100 风险分」「MCP 安装前门禁」；右侧是一张带横线的白色卡片穿过珊瑚橙扫描光束，旁边三枚由橙到黑的圆点"
topStory: true
---

今年 3 月 21 日建仓的一个 NVIDIA 开源项目，七个月里积累到 <strong>21,802 star、1,912 fork、104 位贡献者</strong>，Apache-2.0 许可，要求 Python 3.12+，最新版本 v2.13.1（10 月 23 日）。它回答的问题只有一个：<strong>这个技能装上去安全吗？</strong>

这就是 <strong>SkillSpector</strong>——一个面向 AI 智能体技能（Agent Skills）的安全扫描器。它支持 Claude Code、Codex CLI、Gemini CLI、OpenCode、Pi 等工具使用的技能包与 MCP 配置，既能扫本地目录、单个 `SKILL.md`、Git 仓库，也能扫 zip 包与 URL。

项目给出的背景数字来自一项实证研究：从两个主要技能市场收集 <strong>42,447 个技能</strong>，用「静态分析 + LLM 语义分类」分析其中 <strong>31,132 个</strong>，发现 <strong>26.1% 至少含有一个漏洞</strong>，<strong>5.2% 呈现高严重度、疑似恶意</strong>的特征；而带可执行脚本的技能出问题的概率，是纯指令型技能的 <strong>2.12 倍</strong>（Liu 等，arXiv:2601.10338）。

## 为什么技能需要单独的安全检查

一个技能本质上是一包 Markdown 指令，外加可选的脚本、参考文档与资源文件；装进智能体后，它以用户的权限读文件、跑命令、调工具、访问网络。NVIDIA 的文档直接把它称作新的<strong>供应链攻击面</strong>。

关键词在于「技能本身就是指令」。另一篇论文（arXiv:2606.23416）指出，常见的提示词注入防御依赖「可信指令」与「不可信数据」之间的边界，而技能整包都是指令——注入的命令混在一堆合法指令里，自然继承了同样的权威。于是「安装前扫一遍」成了少有的、能在边界外做的检查。

## 两阶段：确定性规则打底，语义复核可选

SkillSpector 的检测分两层。

<strong>第一阶段是静态分析</strong>：11 个分析器做正则匹配、Python AST 行为分析（`exec`、`eval`、`subprocess` 等危险调用）、YARA 签名、污点追踪，并通过 OSV.dev 实时查询依赖里的已知 CVE，断网时回退到内置清单。官方对自己的评价很克制：<strong>召回高，精确率中等，会有误报</strong>。

<strong>第二阶段是可选的大模型语义分析</strong>：比较技能「声称做什么」与「代码看起来做什么」，用来抓描述与行为不符、触发条件含糊这类静态规则够不着的问题。它有两条硬约束：确定性发现无论模型是否确认都会留在报告里；未被确认的发现标记为 `llm-unconfirmed`。分析提示词本身也做了防越狱处理，避免恶意技能反过来操纵评审模型。

规则总量为 <strong>71 条，分 17 类</strong>（README 现为 71 条，NVIDIA 文档站仍写作 68 条，两边尚未同步）。类别覆盖提示词注入、反拒绝、数据外泄、提权、供应链、过度代理、输出处理、系统提示词泄露、记忆投毒、工具滥用、失控代理、触发器滥用、危险代码、污点追踪、YARA、MCP 最小权限与 MCP 工具投毒。几条有代表性的规则：

- <strong>P9 空白填充</strong>：用大段空白把指令藏在可视区域之外；
- <strong>AR1 拒绝抑制</strong>：要求模型「永不拒绝、始终配合」；
- <strong>E2 环境变量收集</strong>：枚举环境变量以窃取密钥；
- <strong>SC2 远程脚本执行</strong>：`curl | bash` 一类写法；
- <strong>SC4 已知漏洞依赖</strong>：查询 OSV.dev 的实时漏洞库。

## 打分与工程接口

扫描结果是 0 到 100 的风险分：每条 CRITICAL 加 50 分、HIGH 加 25 分、MEDIUM 加 10 分、LOW 加 5 分，含可执行脚本再乘 1.3。分数映射到建议：0-20 为 SAFE，21-50 为 CAUTION，51 以上一律 DO NOT INSTALL（51-80 记 HIGH，81-100 记 CRITICAL）。

对 CI 来说，比分数更实用的是稳定的工程契约：

| 能力 | 说明 |
| --- | --- |
| 输出格式 | Terminal、JSON、Markdown、SARIF，可直接接代码扫描与 IDE |
| 退出码 | 0 表示通过（分数 ≤50），1 表示有阻塞项，2 表示输入或内部错误 |
| 严格门禁 | `--fail-on-findings`、`--fail-on-incomplete`、`--min-coverage` |
| 误报抑制 | baseline 指纹或 glob 规则，只报「新增」问题；源码或版本变化会让旧抑制失效 |
| MCP 服务 | `skillspector mcp` 暴露单个 `scan_skill` 工具，返回风险分、等级、建议与 `safe_to_install` |
| 批量扫描 | 并行扫描整个技能目录，支持中、日、韩内容检测 |

MCP 模式值得单独说一句：它让「扫描」从事后审计变成<strong>运行时护栏</strong>——智能体在安装技能或接入 MCP 服务器前先调用 `scan_skill`，拿到 `safe_to_install` 再决定。HTTP 传输只绑回环地址、不带鉴权，且拒绝本地路径与 `file://`，需要远程访问时应自行加带认证的反向代理。项目另提供 Pi 与 OpenCode 扩展，以及免装 Python 的 Docker 镜像。

## 边界：它不执行技能，也不是沙箱

官方把信任模型写得很清楚：SkillSpector<strong>从不运行被扫描的技能</strong>，所有分析都是静态的（正则、AST、YARA）加上可选的 LLM 文本评审。代价与副作用同样明确：

- 开启 LLM 分析时，分析器可读的文件内容会被发送到所配置的模型服务商；加 `--no-llm` 可让内容留在本地；
- SC4 会把依赖坐标发给 OSV.dev，这一步即使关掉 LLM 也会发生；
- 它不隔离宿主，只负责在安装前指出风险。

已知局限包括：非英文内容可能漏检、图片里的文字、加密或编译后的二进制，以及静态分析天然看不到的运行时行为。

## 作为 NVIDIA 验证流水线的一环

SkillSpector 不是一个孤立工具，它是 NVIDIA Verified Skills 流水线的安全层，运行在 SkillEvaluator 的 <strong>Tier 1</strong>：

1. <strong>Tier 1 验证</strong>：schema、许可证、PII、Unicode 安全，加上 SkillSpector 对暂存范围的扫描，确定性检查可以直接判失败；
2. <strong>Tier 2 去重</strong>：与目录中已有技能做语义重叠比对，避免同一能力换个名字再发一遍；
3. <strong>Tier 3 实跑评测</strong>：在沙箱里让真实智能体带着技能与不带技能各跑一遍任务集，用差值衡量技能到底有没有提升输出。

通过之后还要补一份技能卡（说明所有者、用途、权限与风险）并对目录做 OMS 分离签名。通过验证的技能进入 [NVIDIA/skills](https://github.com/NVIDIA/skills) 目录，可用 `npx skills add nvidia/skills` 安装。这条流水线的逻辑值得记住：<strong>扫描问的是「能不能发」，评测问的是「有没有用」，签名问的是「发的是不是审过的那份」</strong>。

## 反证：扫描器不是终点

两项独立研究给出了必要的冷水。

其一是 <strong>Pretext</strong>（arXiv:2609.39607，Kaiser 与 Dhar，9 月 30 日）：一个知道检测器内部结构的白盒攻击者，可以把载荷从代码搬进自然语言，让静态分析失效；再把指令拆到多个文件、包装成技能的「正当用途」，把 LLM 阶段的信号压到阈值以下。对冻结版本的检测器，绕过率最高 97%；对协同演进的版本仍有 77%。

其二是 <strong>ClawHub Security Signals</strong>（arXiv:2606.01494，5 月 31 日）：在 67,453 个 OpenClaw 技能版本上对比 VirusTotal、静态启发式与 SkillSpector 三类扫描器，发现它们的判断高度不重叠——任意两家的正例重合最多 10.4%，三家同时命中的仅 0.69%。其中 SkillSpector 在 25,504 条可疑样本里命中 19,209 条（75.3%），但在 206 条被登记处判为恶意的样本里只命中 14 条（6.8%）；VirusTotal 在恶意样本上的命中率则是 72.8%。论文的结论很直接：技能安全需要分层治理，不能靠单一扫描器做「放行或拦截」。

这并不否定 SkillSpector 的价值，而是划清了它的位置：它擅长在安装前用低成本、可解释的规则拦下已知的高风险模式，并把「描述与行为不符」这类语义问题摆到台面上；它替代不了来源审查、签名验真，也替代不了运行时隔离。

## 核心总结

- <strong>项目</strong>：NVIDIA 开源的智能体技能安全扫描器，Apache-2.0，2026 年 3 月建仓；截至发稿 21,802 star、1,912 fork、104 位贡献者
- <strong>版本</strong>：v2.13.1（2026-10-23），Python 3.12+，提供 Docker 镜像与 MCP 服务
- <strong>数据</strong>：31,132 个已分析技能中 26.1% 至少含一个漏洞，5.2% 疑似恶意；带脚本技能的脆弱概率是纯指令技能的 2.12 倍
- <strong>检测</strong>：71 条规则 / 17 类，静态分析打底（正则、AST、YARA、污点追踪、OSV.dev），LLM 语义复核可选且不覆盖确定性结论
- <strong>接口</strong>：0-100 风险分与 SAFE / CAUTION / DO NOT INSTALL 建议；JSON、Markdown、SARIF；稳定退出码、baseline 抑制与 CI 门禁
- <strong>护栏</strong>：`skillspector mcp` 让智能体在安装前调用扫描；另有 Pi、OpenCode 扩展与批量扫描
- <strong>边界</strong>：不执行被扫技能、不隔离宿主；LLM 模式会上传文件内容；非英文、图片、二进制与运行时行为是已知盲区
- <strong>反证</strong>：白盒攻击 Pretext 对冻结检测器绕过率最高 97%；ClawHub 研究显示三类扫描器几乎不重叠——分层治理优于单点放行

原文：[NVIDIA/SkillSpector](https://github.com/NVIDIA/SkillSpector)（NVIDIA，Apache-2.0）

参考：

- [Scan Agent Skills Before Installation](https://docs.nvidia.com/skills/scanning-agent-skills)（NVIDIA Skill Documentation）
- [A Trust Pipeline for Agent Skills](https://docs.nvidia.com/skills/agent-skill-trust-pipeline)（NVIDIA Skill Documentation）
- [Agent Skills in the Wild: An Empirical Study of Security Vulnerabilities at Scale](https://arxiv.org/abs/2601.10338)（Liu 等，2026-01-15）
- [Pretext: Defeating Malicious Skill Detection Frameworks for AI Agents](https://arxiv.org/abs/2609.39607)（Kaiser、Dhar，2026-09-30）
- [ClawHub Security Signals: When VirusTotal, Static Analysis, and SkillSpector Disagree](https://arxiv.org/abs/2606.01494)（Koc 等，2026-05-31）
- [Detecting Malicious Agent Skills in the Wild using Attention](https://arxiv.org/abs/2606.23416)（Etteib 等，2026-06-22）
- [SkillSpector v2.13.1 发布说明](https://github.com/NVIDIA/SkillSpector/releases/tag/v2.13.1)（2026-10-23）
- [NVIDIA/skills 技能目录](https://github.com/NVIDIA/skills)
