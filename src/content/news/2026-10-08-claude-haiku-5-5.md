---
title: "Anthropic 发布 Claude Haiku 5.5：最便宜最快的小模型，平均便宜约 75%"
description: "Anthropic 发布 Claude Haiku 5.5：Haiku 档首个可调 effort 小模型，每百万输入 0.1 美元、输出 0.5 美元起。"
pubDate: 2026-10-08
author: "林晓"
category: "models"
tags: ["Anthropic", "Claude Haiku 5.5", "小模型", "模型定价", "可调 effort", "AI Agent", "AI 安全"]
image: "/covers/2026-10-08-claude-haiku-5-5.jpg"
imageAlt: "封面：深炭黑底配琥珀黄斜切色块，上方超大标题「Claude Haiku 5.5 发布」与副标题「最便宜、最快的小模型」，下方为定价行与琥珀黄同心波纹环绕的小几何核心"
topStory: true
---

2026 年 10 月 7 日，Anthropic 发布 **Claude Haiku 5.5**（模型 ID `claude-haiku-5-5`），官方称它是「我们发布过的最便宜、最快、能力最强的小模型」。按 Anthropic 的测算，它<strong>平均比 Haiku 4.5 便宜约 75%</strong>，每百万输入 token 0.1 美元起、输出 token 0.5 美元起。这也是 Haiku 这一档模型<strong>首次带上可调 effort 设置</strong>，用户可以在成本和智能之间自行取舍。

## 定位：接住那些「太小不值得用大模型」的活

Haiku 5.5 面向高吞吐、成本敏感的负载：摘要、上下文压缩（compaction）、数据库查询、分类请求这类「快而重复」的工作。Anthropic 同时给出了两种搭配方式——在编码任务里，它适合作为 Opus 5.5 与 Sonnet 5.5 的<strong>子智能体（subagent）</strong>；在对速度敏感的场景（实时客服、浏览器操作）里，它因为「迄今最快」而可以直接当主力。

需要说清楚的是，Haiku 5.5 并不打算取代大模型。Anthropic 明确表示，<strong>Sonnet 5.5 与 Opus 5.5 仍是 Terminal-Bench 4.0 这类复杂智能体编码任务的更好选择</strong>；Haiku 5.5 的价值在于，把过去因为成本过高而做不了的窄范围任务变得可做。

## 定价：100k token 是分水岭

Haiku 5.5 采用按提示长度分档的计价方式，每百万 token 价格如下：

| 每百万 token | Haiku 5.5（≤100k / >100k） | Haiku 4.5 | Sonnet 5.5 |
| --- | --- | --- | --- |
| 缓存读取 | $0.01 / $0.05 | $0.10 | $0.10 |
| 缓存写入 | $0.125 / $0.625 | $1.25 | $2.50 |
| 输入 token | $0.10 / $0.50 | $1.00 | $2.00 |
| 输出 token | $0.50 / $2.50 | $5.00 | $10.00 |

按 Anthropic 的脚注，100k token 以内的请求<strong>比 Haiku 4.5 便宜 90%</strong>，超过 100k 的部分便宜 50%；而在 Haiku 4.5 上，<strong>约 90% 的请求都落在 100k 以内</strong>，这正是「平均便宜约 75%」的来源。官方也提醒，Haiku 5.5 换用了更新的分词器（与 Sonnet 5.5、Opus 5.5 类似），<strong>完成同一项工作会多消耗一点 token</strong>，上述折算已经把这一点算进去了。

## 基准：知识工作逼近大模型，智能体编码仍有明显差距

| 基准 | 方向 | Haiku 5.5 | Haiku 4.5 | GPT-6 Luna | Sonnet 5.5 |
| --- | --- | --- | --- | --- | --- |
| GDPval-AA v2.1 | 知识工作 | **1620** | 735 | 1437 | 1840 |
| AA-Briefcase v1.1 | 知识工作 | **1578** | 614 | 1336 | 1824 |
| OSWorld 2.1（离线子集） | 计算机操作 | **72.4%** | 15.7% | 48.9% | 83.9% |
| Humanity's Last Exam | 多学科推理 | 45.9%（无工具）/ 57.4%（带工具） | 10.2% / 18.7% | — | 56.9% / 64.5% |
| Terminal-Bench 4.0 | 智能体编码 | 39.2% | 0.0% | 16.4% | **70.6%** |
| FrontierCode 1.1（Main） | 智能体编码 | 46.4% | — | 42.4% | **52.1%** |
| Chartography | 视觉推理 | 46.4% | 6.4% | 29.1% | **61.6%** |

几个可以直接读出来的结论：

- **相比 Haiku 4.5 是断层式提升**：知识工作与计算机操作类基准普遍是数倍差距，OSWorld 2.1 从 15.7% 拉到 72.4%，Terminal-Bench 4.0 从 0.0% 到 39.2%。
- **对上一档模型的追赶并不均匀**：GDPval-AA、AA-Briefcase 上已经接近 Sonnet 5.5（1840、1824），但在智能体编码与视觉推理上仍落后十几到二十个百分点，<strong>Haiku 5.5 在 FrontierCode 1.1 上反而略微落后 GPT-6 Luna</strong>。
- **和 GPT-6 Luna 相比各有胜负**：知识工作、计算机操作、视觉推理与多学科推理上 Haiku 5.5 领先，FrontierCode 1.1 上落后。

## 首个可调 effort 的 Haiku 级模型

Haiku 5.5 是 Haiku 这一档<strong>第一次支持可调 effort</strong>，提供 Low / Med / High / Xhigh / Max 五档，把「花多少钱」和「拿到多少分」交给用户自己权衡。Anthropic 给出了三张「精度—成本」曲线图，分别在 OSWorld 2.1（计算机操作）、GDPval-AA（知识工作）与 Humanity's Last Exam（多学科推理）上对比 Haiku 5.5、Haiku 4.5、Sonnet 5.5 与 GPT-6 Luna，横轴为每次尝试的成本（对数刻度）。官方没有给出具体的 token 速度数字，只强调它是「在各模型标准速度下迄今最快」。脚注补充了一点边界条件：<strong>在 Fast Mode 下，Opus 系列仍然比 Haiku 5.5 快</strong>。

## 客户实测：延迟和单位成本是主要收益

Anthropic 这次没有给出自家员工的原话，六段引语全部来自客户：

- **Asana**（Staff Software Engineer Aaron Vinh）：在 AI Teammates 的评测中，「任务完成延迟下降超过 30%，每个智能体轮次的推理速度最高提升 2.5 倍」。
- **HubSpot**（Distinguished Software Engineer Ze'ev Klapow）：CRM 任务套件上三次运行平均 <strong>92.8%</strong>，是该套件见到的最好成绩；在一个「识别陈旧但含糊的客户记录」的审计任务上，Haiku 5.5 完成最快，命中率最高、误报率最低。
- **AlphaSense**（Distinguished Engineer Daniel Campos）：Ask in Document 每周约 800 万次调用，在 400 条查询上以 <strong>0.84 对 0.76</strong> 的分数显著优于 Haiku 4.5。
- **Box**（VP of AI Products Yashodha Bhavnani）：早期测试中「比 Haiku 4.5 高 11 分，延迟约为一半」，将用于规模化分析类工作。
- **Rogo**（Applied AI Alex Wang）：大模型搭稿时，Haiku 5.5 子智能体可以进 10-K 里把分部营收那一行取出来。
- **Cognition**（Co-Founder & CPO Walden Yan）：Haiku 5.5 加入 Devin Fusion 的 sidekick 阵容后，Fusion 的 FrontierCode 分数达到 <strong>66.2</strong>，同时降低成本与延迟。

## 安全：护栏比上代更严，但比近期其他模型更松

**对齐（Alignment）**：Anthropic 称 Haiku 5.5 与 Haiku 4.5 相比「在几乎所有对齐评测上都有重大改进」，<strong>失准行为明显减少，配合滥用的意愿也更低</strong>，方法与结果见 Haiku 5.5 系统卡。

**保障措施（Safeguards）**：网络能力方面，Haiku 5.5 的护栏<strong>比 Haiku 4.5 更严格，但比 Anthropic 近期其他模型的护栏宽松一些</strong>——比 Sonnet 5.5 允许更宽泛的防御性任务，不过仍然拦截渗透测试等更可能被攻击者使用的手法。生物方面，其护栏与 Sonnet 5、Sonnet 5.5 和 Opus 5 一致：允许研究性生物学问题，但限制被判断为可能造成危害的请求。需要更宽生物或网络访问权限的机构，可以申请生命科学验证计划（Life Sciences Verification Program）与网络验证计划（Cyber Verification Program）。

## 可用性与同期更新

Haiku 5.5 已在所有平台上线，包括 AWS、Google Cloud 与 Microsoft Azure；在 Claude Platform 上开发者可直接使用 `claude-haiku-5-5`，官方另附迁移指南。

同一批更新还有三件事：

- **Sonnet 5.5 缓存读取降价一半**：从每百万 token 0.20 美元降到 0.10 美元。由于缓存读取在 token 消耗中占比很大，Anthropic 估算<strong>多数智能体任务上 Sonnet 5.5 的成本因此降低约 20%</strong>。
- **Max 与 Team 订阅者新增每月 API 额度**：Max 5x 每月 100 美元、Max 20x 每月 200 美元，Team 订阅者在成员之间共享最多 500 美元，可用于任意模型。
- **SDK 增加计算机操作与浏览器操作支持（beta）**：Python 与 TypeScript SDK 同步更新，Anthropic 认为 Haiku 5.5 的速度、能力与价格组合特别适合这类任务。

## 核心总结

- **发布**：2026 年 10 月 7 日发布 Claude Haiku 5.5，模型 ID `claude-haiku-5-5`，已在 AWS、Google Cloud、Azure 与 Claude Platform 上线
- **价格**：≤100k token 时每百万输入 0.1 美元、输出 0.5 美元，缓存读取 0.01 美元；官方称平均比 Haiku 4.5 便宜约 75%，且已计入新分词器带来的 token 增长
- **能力**：GDPval-AA v2.1 1620、AA-Briefcase v1.1 1578、OSWorld 2.1 72.4%，均大幅超过 Haiku 4.5；但在 Terminal-Bench 4.0（39.2%）与 FrontierCode 1.1（46.4%）上仍明显落后 Sonnet 5.5 与 Opus 5.5
- **新特性**：Haiku 档首个可调 effort 模型，Low 到 Max 五档；官方称其为标准速度下最快模型，但 Fast Mode 下不及 Opus
- **安全**：对齐评测相比 Haiku 4.5 大幅改善；网络护栏比 Haiku 4.5 严、比近期其他模型松，生物护栏与 Sonnet 5 / Opus 5 一致
- **同期更新**：Sonnet 5.5 缓存读取降价 50%（智能体成本降约 20%）、Max 与 Team 订阅者获每月 API 额度、Python 与 TypeScript SDK 加入计算机操作与浏览器操作 beta

原文：[Introducing Claude Haiku 5.5](https://www.anthropic.com/claude-haiku-5-5)（Anthropic，2026-10-07）
