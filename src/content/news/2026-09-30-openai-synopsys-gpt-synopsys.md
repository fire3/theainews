---
title: "OpenAI 与 Synopsys 合作推出 GPT-Synopsys：面向芯片设计的专用模型"
description: "OpenAI 与 Synopsys 签多年期协议共研 GPT-Synopsys：让前沿模型原生学会用 EDA 工具做芯片设计，算力、模型、许可证打包销售并分成。"
pubDate: 2026-09-30
author: "林晓"
category: "industry"
tags: ["OpenAI", "Synopsys", "GPT-Synopsys", "EDA", "芯片设计", "半导体", "专用模型", "智能体"]
image: "/covers/2026-09-30-openai-synopsys-gpt-synopsys.jpg"
imageAlt: "封面：白底信息图分栏，左栏标题「GPT-Synopsys 发布」与两行要点，右栏为芯片版图与节点连线示意，标注 EDA 原生专用模型"
topStory: true
---

9 月 30 日，EDA（电子设计自动化）厂商 Synopsys（Nasdaq: SNPS）与 OpenAI 宣布战略合作，签署多年期协议，联合开发 <strong>GPT-Synopsys</strong>——一个针对「用 Synopsys EDA 工具执行半导体设计工作流」做过优化的专用模型。协议包含收入分成安排与联合市场推广，双方将共同把 GPT-Synopsys 面向全球客户提供；OpenAI 也将授权使用 Synopsys 的 EDA 工具来训练和开发这个模型。

## 合作形式：多年期协议 + 收入分成

按新闻稿披露的三项要点：

- 两家公司以<strong>优先合作伙伴</strong>身份签署多年期协议，共同开发并交付面向芯片设计的专用模型 GPT-Synopsys；
- OpenAI 将<strong>授权使用 Synopsys 的 EDA 工具</strong>，用于该专用模型的开发；
- 双方在研发与联合市场推广上紧密协作，<strong>共享收入框架</strong>。

新闻稿未披露交易金额、分成比例与时间表，并加入了关于 GPT-Synopsys 开发节奏与收益的前瞻性声明风险提示。

## 技术思路：让前沿模型成为 EDA 工具的「原生专家」

新闻稿把现状与目标讲得很清楚：今天的智能体技术是把<strong>通用模型接到 EDA 工具上</strong>跑芯片设计流程；这次合作要做的下一步，是让前沿模型<strong>成为使用 EDA 工具的专家</strong>——像资深工程师那样运行工具、解读输出，并用工具反复迭代优化设计。

具体到工程侧，工程师可以把设计目标（从 PPA 优化到时序收敛与验证收敛）委托出去，由智能体运行工具、解读结果、实施变更，一路迭代到<strong>可供工程师评审的已验证结果</strong>。这里的 PPA 指功耗、性能、面积（power, performance, area）三项芯片设计的核心权衡指标。

落地形态上，GPT-Synopsys 运行在 OpenAI 托管的基础设施上，设计为可与客户自有的智能体运行框架（agent harness）互操作，并与 Synopsys.ai 及 Synopsys 的智能体 AI 平台 <strong>Autopilot</strong> 深度集成。双方称正与头部半导体客户开展早期技术合作。

## 商业与数据：捆绑交付，客户数据不训练

联合服务将<strong>打包算力、模型与许可证</strong>，同时保护客户特有的设计数据。GPT-Synopsys 提供企业级安全、治理与访问控制：客户数据不用于训练模型，静态与传输过程均加密，并可通过可配置的保留、审计与权限控制来管理。

## 双方表态

Synopsys 总裁兼 CEO Sassine Ghazi 表示（译文）：「半导体工程的未来，要求在不牺牲 PPA 和一次流片成功率的前提下，大幅加速芯片设计流程。这项协议将扩大 Synopsys 先进设计能力的覆盖，以及把日益复杂的芯片推向市场所必需的、作为地面真值（ground truth）的工程工具。」他称双方「把前沿智能带进芯片设计」，帮助更多公司开发并加速先进制程芯片，同时保持制造成功所需的严谨与可信。

OpenAI 总裁兼联合创始人 Greg Brockman 表示（译文）：「我们正在用最先进的技术，改进驱动 AI 的那些系统。与 Synopsys 合作，我们把这项工作带进芯片设计，帮助工程师探索更多方案、更快拿到可工作的芯片。帮助他们造出更好的芯片，我们就能构建更好的 AI，并把它带给更多人。」

## 核心总结

- <strong>合作</strong>：多年期优先合作伙伴协议，联合开发专用模型 GPT-Synopsys，收入分成 + 联合市场推广，金额未披露
- <strong>定位</strong>：不是「通用模型接 EDA 工具」，而是让前沿模型原生学会运行、解读并迭代 EDA 工具
- <strong>用法</strong>：工程师委托 PPA 优化、时序与验证收敛等目标，智能体跑工具出结果，最终由工程师评审
- <strong>部署</strong>：跑在 OpenAI 托管基础设施上，可对接客户 agent harness，深度集成 Synopsys.ai 与 Autopilot
- <strong>数据</strong>：算力、模型、许可证打包交付；客户数据不用于训练、全程加密、保留与审计可配置
- <strong>进度</strong>：已与头部半导体客户展开早期技术合作，未公布时间表

原文：[OpenAI and Synopsys Announce GPT-Synopsys: Frontier Intelligence to Revolutionize Chip Design](https://news.synopsys.com/2026-09-30-OpenAI-and-Synopsys-Announce-GPT-Synopsys-Frontier-Intelligence-to-Revolutionize-Chip-Design)（Synopsys 新闻室 / PRNewswire，2026-09-30）
