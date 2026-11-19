---
title: "Gemini 4 Neon 发布：前沿智能下探中端价位，主打智能体编码与网络防御"
description: "Google 发布 Gemini 4 Neon：百万 token 上下文，定价每百万输入 3 美元、输出 15 美元，AA 智能指数 61 排名第三，单任务成本比 Carbon 低 32%，并推出面向防御者的 cyber 版本。"
pubDate: 2026-11-18
author: "林晓"
category: "models"
tags: ["Google DeepMind", "Gemini 4 Neon", "前沿模型", "智能体", "API 定价", "网络安全", "基准测试"]
image: "/covers/2026-11-18-gemini-4-neon.jpg"
imageAlt: "封面：深海军蓝渐变底，超大紫色霓虹空心「4」为视觉核心，下方白色主标题「Gemini 4 Neon」，副标题标注前沿智能、3/15 美元定价与百万 token 上下文"
topStory: true
---

11 月 18 日，Google 发布 Gemini 4 系列新成员 <strong>Gemini 4 Neon</strong>，定位「前沿级智能 + 快速端到端任务完成」，面向复杂软件工程、知识工作与科学计算工作流。模型提供 100 万 token 上下文窗口，定价为每百万输入 token 3 美元、输出 token 15 美元，缓存输入 0.15 美元（约 95% 折扣），即日起在 Gemini API、Google AI Studio、Gemini for business、Google Antigravity 与 Gemini 应用（AI Pro/Ultra 订阅档）陆续推出。

![Gemini 4 Neon 发布头图](/images/gemini-4-neon-blog-header.png)

## 在 Gemini 4 家族中的位置

Google 对三代模型的分工已经清晰：**Carbon 负责最困难的长程项目，Hydrogen 负责快速的日常执行，Neon 在两者之间平衡深度与效率**。这也是继 10 月中 Argon 转 Stable、11 月 12 日 Hydrogen 发布之后，Gemini 4 家族在一个月内的又一次扩充——Neon 把前沿级推理能力下沉到更低成本、更高频次的生产工作流中。

Neon 提供四档思考等级（thinking level）。按官方数据，默认 high 档在保持较高智能指数的同时，<strong>单任务成本比 Carbon 低 32%</strong>；在 Vals Index 与 Agent Arena 上均位于帕累托前沿（Pareto frontier），单任务成本比头部竞品前沿模型低约 50%–80%；最高的 xhigh 档针对最难的工程、分析与科学工作负载，单任务成本仍比竞品最高档低 36% 以上。

## 评测：第三方榜单全面进入前列

在第三方评测中，Neon 在 Artificial Analysis 智能指数（xhigh 档）取得 61 分、总排名第三，仅次于更大更慢的模型；Vals Index 排名第二（70.9%）并位于帕累托前沿；在 Arena 新推出的 Agent Arena Index 上，Neon 以 1336 分全球排名第二，该榜单覆盖 4200 多个真实智能体会话，Neon 同时在「可操纵性」（任务中途干净地接受用户修正）上排名第二。

企业场景的细项成绩包括：

- **法律与税务**：Legal Research Bench 与 Tax Agent Bench 双料第一
- **金融与表格**：Surge AI 金融、会计、表格建模与复杂约束遵循等多数基准第一
- **自动化与长程经营**：Zapier AutomationBench（56.3%）与 Andon Labs Vending-Bench 2（$16,843）均为第一
- **图表与综合**：Chartography 73.5%，Agents' Last Exam v1.1 75.8%

科学推理方面，Neon 在 Terminal-Bench Science（70.5%）、RiemannBench（84.0%）与 HLE-Diamond（71.3%）上均为同类最佳。

## 为生产级代码而生

Neon 面向长时间运行的智能体工作流设计：减少重复读文件、边干活边同步进度、在长会话中可靠地压缩上下文，既可以独立执行任务，也可以在 Google Antigravity 中充当「编排者（Orchestrator）」，调度并行的 Hydrogen 子智能体。编码成绩上，Neon 在 Artificial Analysis Coding Agent Index 以 58.6 分总排名第一，Terminal-Bench 4.1 得分 65.2%，FrontierCode 2.0 得分 46.2%（默认 high 档）。

仓库级工程能力是一个亮点：在 SWE-sweep 上，Neon 裸跑 mini-SWE 测试架即以 12.8% 领先，接入 Antigravity 后<strong>提升至 39.0%，为当前最佳</strong>。官方称这展示了 Antigravity 智能体框架对模型能力的放大作用。

## cyber 版本：写安全代码，也找漏洞

同场发布的 Gemini 4 Neon for cyber 是这次更新中更值得关注的分支，覆盖「写防御性代码—找漏洞—验证—修补」全链条：

- **安全编码**：在 AutoBaxBench 全部难度档位上优于 Carbon，困难档 76% 为最佳
- **漏洞挖掘**：WebExploitBench v1.2 得分 51.26% 为最佳，成本约为同类大模型的一半；SEC-bench Pro 得分 90.5%
- **漏洞验证与修补**：ExploitGym 上以 Carbon 一半的 token 达到前沿水平；CWE-bench v2 得分 70.7%，较 Carbon 提升 3.4 个百分点

Neon for cyber 将在未来几天通过 Fairwind Program 向可信防御者开放，延续 Argon 当初的定向发布路径。

## 安全与对齐数据

Neon 沿用 Gemini 4 安全栈，在保持 Carbon 级别的严重滥用与提示注入防护的同时进一步降低误拒：Terminal-Bench 4.0 上仅拒答 1.98%，Terminal-Bench Science 上为 0%。行为纪律方面，Terminal-Bench 4.0 作弊率 0.0%，内部编码评测中走捷径比例 2.45%（Gemini 4 各模型最低），智能体安全套件误对齐动作率 0.09%，智能体诚实度评测通过率 99.2%。在 Gray Swan 间接提示注入（IPI）基准上，最高思考档配合实时防护<strong>抵御了全部攻击，攻击成功率 0.0%</strong>。官方同时公布了模型卡（model card）供查阅。

## 核心总结

- Gemini 4 Neon 定位介于 Carbon 与 Hydrogen 之间：前沿级智能 + 更低成本，主打复杂编码、分析与生产级企业工作流
- 定价 $3/$15 每百万 token，缓存输入 $0.15，100 万 token 上下文，四档思考等级；默认 high 档单任务成本比 Carbon 低 32%
- AA 智能指数 61（第三）、Vals Index 第二、Agent Arena Index 1336（第二）；法律、税务、自动化、长程经营等多项基准第一
- 编码上 AA Coding Agent Index 58.6 第一；SWE-sweep 在 Antigravity 中达 39.0% 为最佳，可作为 Orchestrator 调度 Hydrogen 子智能体
- cyber 版本覆盖安全编码、漏洞挖掘、验证与修补全链条，通过 Fairwind Program 定向开放
- 安全侧：作弊 0.0%、捷径率 Gemini 4 系最低，Gray Swan IPI 攻击成功率 0.0%

原文：[Introducing Gemini 4 Neon](https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-4-neon/)（Google 官方博客，2026 年 11 月 18 日）
