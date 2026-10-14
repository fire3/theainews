---
title: "Gemini 4 Argon 结束定向预览：API 转 Stable，限时价格 2/10 美元只有七周"
description: "Gemini 4 Argon 正式上线：Gemini API 转 Stable、进入 Gemini 应用与 AI 搜索模式，限时价每百万输入 2 美元、输出 10 美元，12 月 1 日起翻倍为 4/20 美元。"
pubDate: 2026-10-14
author: "林晓"
category: "models"
tags: ["Google DeepMind", "Gemini 4 Argon", "前沿模型", "API 定价", "Google Antigravity", "Token 效率", "Artificial Analysis"]
image: "/covers/2026-10-14-gemini-4-argon-ga.jpg"
imageAlt: "封面：浅色工程蓝图风格，左侧纵向进度条自「9·30 定向预览」推进到「10·13 Storable API 正式发布」并停在 11 月 30 日的限时价节点，右侧为 2 美元与 4 美元两档价格与一行成绩，蓝灰与琥珀配色"
topStory: true
---

10 月 13 日，Google 宣布 <strong>Gemini 4 Argon 面向全球开发者与企业开放</strong>。9 月 30 日首发时，这个模型只通过 Fairwind Program 定向交给一批可信网络防御者；如今它进入<strong>付费档 Gemini API 的 Stable 通道</strong>，同时上线 Google AI Studio、Android Studio、Gemini 应用与搜索的 AI 模式。Google 开发者生态负责人 Logan Kilpatrick 表示，全栈团队为此连续投入了六个月，发布前一个月有超过 10 万名 Google 员工参与真实场景测试。

按 Google 公布的节奏，「Argon 是什么」在两周前已经讲完，「现在能用、多少钱、能撑多久」才是这次发布的主语。

## 三条通道同时打开，免费档仍然排除在外

- <strong>开发者</strong>：Gemini API 付费档，模型 ID 为 `gemini-4-argon`，API 目录中已列为 <strong>Stable</strong> 而非 Preview、Latest 或 Experimental；Google AI Studio 与 Android Studio 同步可用。
- <strong>企业</strong>：同一套 API 通道；Google 同时把 Fairwind Program 的受信任伙伴扩大到数百家，与 Wiz 的 Scan for Good 继续合作。
- <strong>订阅用户</strong>：Google AI Ultra 与 Pro 可在 Gemini 应用、搜索 AI 模式中使用，Ultra 还可在 AI Studio 与智能体开发平台 <strong>Google Antigravity</strong> 中直接跑工作流。

值得注意的是，与最近两次进入 AI 模式菜单的模型一样，Argon <strong>只对订阅档开放</strong>：免费档用户的 AI 模式默认模型不变，Google 也没有说明 Argon 是否会转正为默认。搜索产品副总裁 Robby Stein 在 X 上确认它在搜索中「已经面向全球推送」，同时提到 Argon 比此前任何 Gemini 模型都更善于遵循风格指令。

## 限时价 2/10 美元，12 月 1 日翻倍

这次发布里对开发者影响最直接的是价格。100 万 token 的上下文窗口由输入、思考与输出共享，官方给出的价格表如下：

| 计费档 | 输入（每百万 token） | 输出（每百万 token） |
| --- | --- | --- |
| 限时优惠（至 2026-11-30） | <strong>2 美元</strong> | <strong>10 美元</strong> |
| 标准价（2026-12-01 起） | 4 美元 | 20 美元 |
| Batch / Flex | 1 美元 | 5 美元 |
| Priority | 3.60 美元 | 18 美元 |

换算下来，Batch 档相当于标准价的半价，缓存输入为每百万 0.1 美元——按输入价的 5% 计费。输出价格包含思考 token，「长时间解码」能把单次输出上限从默认的 6.4 万 token 拉到 100 万。此外，单项计费里目前<strong>只支持隐式缓存，显式缓存尚未开放</strong>，计算机操作（Computer Use）仍在 Preview。

从 12 月 1 日起 4/20 美元的标准价，与 Claude Opus 5.5 完全对齐，也正好是 Meta 在 10 月 12 日给 Muse Wonder 定的价格。留给开发者的迁移与验证窗口只有一个半月。

## 官方成绩与第三方读数出现落差

Google 这次强调的最高思考档位对比中，Argon 在官方评测里拿下多数第一，口径与 9 月 30 日发布时一致：DeepSWE v1.1 77.9%、Vals Index 68.9%、AutomationBench 51.3%、Harvey 法律智能体基准 19.6%、LABBench 2 88.8%、长视频理解 LVBench 91.7%，CWE-bench v1 以 68% 与 GPT-6 Astra 并列第一。失分项同样没有变化——FrontierSWE v2 与 Terminal-bench 4.0 上仍落后对手。

第三方读数的口径不同。Artificial Analysis 的综合智能指数给 Argon 打了 <strong>53 分</strong>，与 GPT-6 Astra、Claude Fable 5.1 持平，但低于 Claude Opus 5.5（58）与 Sonnet 5.5（56）。该平台同时给出一个对长程智能体更要紧的指标：<strong>幻觉率 15%，是高分组中最低的</strong>，作为对照，GPT-6 Astra 在同组评测中的幻觉率为 51%。在 Arena 的文本偏好榜上 Argon 拿到 1525 分登顶，网页开发榜则只排到第八。

## 落地案例：从 600 万行重构到一夜优化

Google 公布的案例大多来自自家流程，几个有明确数字的：

- <strong>Chrome 架构重构</strong>：在约 4000 万行的 Chromium 代码库中，把核心功能从一个约 600 万行的历史目录中剥离，官方称原本以月计的架构重构被压缩到数周。
- <strong>内部智能体提效</strong>：在内部 Antigravity 构建上试用四周后，工程智能体的代码提交量增加 <strong>35%</strong>，提交后回滚减少近三分之一。
- <strong>ADK 一夜优化</strong>：对开源智能体开发框架 Agent Development Kit 跑了一轮夜间优化，长会话的内存准备时间缩短 <strong>40%</strong>，冷启动导入快 <strong>21%</strong>。
- <strong>Gemma 4 E2B 推理提速</strong>：单张 A100 上从约 3.79 万 token/秒提升到超过 10.8 万 token/秒，约 <strong>2.85 倍</strong>，手段是注意力调优加投机解码。
- <strong>量子纠错吞吐翻倍</strong>：在 AlphaQubit 项目中把内部量子纠错解码器改写为优化过的硬件内核，推理吞吐接近翻倍。

外部与学术侧的案例也在补充：Google 称与马里兰大学研究者合作，用 Argon 找到了更多针对 Grad 猜想的反例；Gamow Labs 用它发现了一处多年未被识别的染色体结构重排；另有 5 种由模型设计、并在实验室通过催化活性验证的新酶。机器人与仿真方面，Real2Sim 项目让 Argon 观看真实遥操作视频来搭建数字孪生环境、生成物理属性可信的仿真资产，再通过视觉推理迭代修正；另一个演示把「人形机器人投掷箱子」的手绘草图转成 GPU 加速仿真与全身轨迹，在物理引擎中验证六个箱子全部倒下。Google 也坦承，仿真中的成功不等于真机可靠。

## 第三方需要留意的地方

- <strong>基准与真实编码体感的落差</strong>：彭博社报道称，部分 Google 员工认为 Argon 在真实编码任务上的表现不及基准分数所显示的水平。
- <strong>用 token 换智能的成本结构</strong>：有测算指出 Argon 单任务平均输出约 6.2 万 token，是 GPT-6 Astra 的 2.3 倍；按限时价折算每任务约 1.99 美元、比 Astra 低约 40%，但 12 月 1 日价格翻倍后，这一优势可能反转。Batch 半价与隐式缓存是缓解手段，但样本工作的长度本身没有变。
- **案例的可复现性**：官方列举的提效案例基本来自 Google 自家代码库与基础设施，外部团队能否复现仍待验证；第三方评测者也提到多智能体协作、置信度校准与工具链上仍有短板。

据外部报道，Google 已在测试下一代模型 Barium 与 Carbon。

## 核心总结

- <strong>状态变化</strong>：Gemini 4 Argon 结束 Fairwind 定向预览，Gemini API 目录中转为 <strong>Stable</strong>（模型 ID `gemini-4-argon`），同步进入 AI Studio、Android Studio、Gemini 应用与搜索 AI 模式
- <strong>价格</strong>：限时每百万输入 2 美元、输出 10 美元（至 11 月 30 日），12 月 1 日起为 4/20 美元；Batch 半价、缓存输入 0.1 美元，仅支持隐式缓存
- <strong>规格</strong>：100 万 token 上下文由输入、思考、输出共享，默认输出上限 6.4 万 token，长时间解码可扩到 100 万；API 侧不适用于免费档与 Google AI Pro
- <strong>成绩</strong>：官方口径 DeepSWE v1.1 77.9% 等多榜第一；第三方 Artificial Analysis 智能指数 53 分，与 Astra、Fable 5.1 持平但低于 Opus 5.5，幻觉率 15% 为高分组最低
- <strong>待观察</strong>：基准与真实编码任务之间的落差、长输出带来的 token 成本、以及官方案例多为自家场景，是这次开放后最需要外部验证的三件事

原文：[Gemini 4 Argon is now available for developers](https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-4-argon/)（Google，2026-10-13）；[Gemini 4 Argon：迈入前沿智能新时代](https://deepmind.google/models/gemini/)（Google DeepMind）
