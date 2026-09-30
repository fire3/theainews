---
title: "OpenAI 发布 dots：由 GPT-6 Astra 驱动的常驻云端智能体"
description: "OpenAI 发布常驻智能体 dots：云端电脑与浏览器、4000+ 应用，贯通 ChatGPT、Slack、Teams，Pro、Enterprise 首发。"
pubDate: 2026-09-30
author: "林晓"
category: "tools"
tags: ["OpenAI", "dots", "GPT-6 Astra", "AI 智能体", "ChatGPT", "Slack", "企业级"]
image: "/covers/2026-09-30-openai-introducing-dots.jpg"
imageAlt: "封面：浅色底上一张由细线相连的圆点网络，中央一颗放大的蓝色圆点连向四周小圆点，上方大字「OpenAI 发布 dots」，副标题「GPT-6 Astra 驱动的常驻智能体」，左右两侧标注 4000+ 应用与 24/7 云端工作"
topStory: true
---

OpenAI 今日发布常驻智能体产品 <strong>dots</strong>。它由新一代旗舰模型 GPT-6 Astra 驱动，每个 dot 拥有自己独立的云端电脑和浏览器，可借助插件生态连接 <strong>4,000 多个应用</strong>，7×24 小时围绕用户的目标持续工作。首批面向 Pro、Business Premium 与 Enterprise（含 Edu、Healthcare）计划在合规市场开放。

## dots 是什么

按 OpenAI 的定义，dot 是「常驻、能干重活的智能体」：它会记住什么对你重要，替你把重要工作从日程里拿走。它不是一次一问的对话窗口，而是一个持续存在的协作者——你可以在 ChatGPT、Slack、Teams 里随时找到它（短信支持即将上线），既可以发消息、派任务，也可以直接语音通话把它「叫过来聊」。

与 dot 合作得越久，它越了解你的偏好、思考方式，以及你心中「做好」的标准。OpenAI 强调 dots 的价值在于「按你的方式交付成果，有时在你还没想到开口之前」。

## 自主工作：自己的云端电脑

dot 可以用自己的云端电脑、自己的浏览器和已连接的应用完成几乎所有工作，用户随时可以打开这台电脑检查它在做什么。除自身环境外，dot 也能被授权连接用户的笔记本，直接在本机旁边协作。

一个 dot 可以同时推进多个项目：你可以不断丢给它新任务和想法，而不必为每件事开新会话、盯每一步。OpenAI 给出的内外部例子包括：

- Slack 里出现一个 bug，dot 立刻开始排查；
- 新设计稿到达，dot 把它做成可运行的应用，团队继续处理客户反馈；
- 进入规划周期，dot 持续同步各方进度、盯住截止日期；
- 一位早期测试者漏给某媒体开票，dot 发现后把发票准备好，经他批准后发出。

今天起用户可以创建自己的第一个 dot 并给它起名。OpenAI 表示未来会演进到「一队 dot 替你协同工作」，并同步预告了 <strong>specialist dots（专职 dot）</strong>的预览版本。

## 上下文贯通所有渠道

dots 的另一卖点是上下文不丢：在 ChatGPT 里开的项目，可以在 Slack 里同步给团队，dot 会带着完整上下文继续推进；它也会主动给你发消息，汇报进度、提出问题或请你做决定。

## 安全、权限与数据

- **独立运行环境**：每个 dot 在自己的云端电脑上工作，用户电脑与其内容默认隔离，除非主动授权连接；登录已支持的网站时，dot 使用系统保存的密码，<strong>密码本身不暴露给模型</strong>。
- **后台只读的「主动研究」**：不被打扰时，dot 会在后台寻找可帮忙之处，但只通过用户已连接应用的<strong>只读工具</strong>运行——不能发消息、不能修改应用内容、不能控制浏览器或电脑。
- **规则与审批**：dot 内置「何时自主行动、何时请求批准」的默认规则，用户可用 Custom Rules 对具体动作设为允许、需审批或禁止，并在 Activity View 里跟踪包括后台工作在内的进度。dot 会用 auto-review 核查可能影响账号或外发信息的动作；改密码这类敏感任务始终留给用户。
- **监控与兜底**：内置安全机制用于抵御恶意指令、监测潜在有害行为，监控系统发现问题时可暂停或停止 dot 的工作。
- **数据政策**：ChatGPT Business、Enterprise、Edu 工作区内容默认不用于改进模型；个人计划可自行选择。OpenAI 表示不会直接在主动研究内容和 dot 的自我笔记上训练。

OpenAI 同时发布了配套的安全博客与 system card，并提醒：dots 仍会犯错，重要工作需要复核。

## Specialist dots：组织内的专职智能体

个人 dot「为你工作」，而 <strong>specialist dots</strong> 承担组织内的固定职责：由公司为它配置独立身份、凭证与所需系统权限，接入企业的系统记录（systems of record），在工作中随反馈持续改进。OpenAI 称其内部已在采购、发票处理、邮件营销、客户支持与商业合同等场景试点，目前以企业试点方式推进，由工程团队与组织共同界定职责、工具与人审流程。

OpenAI 还宣布与 Microsoft 合作，把 specialist dots 接入 <strong>Agent 365</strong> 的企业治理与安全控制，让企业用既有微软工具管理 dots。

## 定价与开通方式

- 首个 dot 免费包含在 Pro 或 Business Premium 计划中，7×24 可用；计划内含一定「深度工作」额度，上线首月额度放宽。
- 与 dot 的对话<strong>不计入</strong> ChatGPT 用量限制；但它代你发起或管理的 Codex、ChatGPT Work 任务照常计费。
- Enterprise（含 Edu、Healthcare）在工作区管理员开启后可试用 beta。
- 开通流程：在 ChatGPT 桌面应用或浏览器创建 dot、连接应用、让它自我介绍，之后可在移动端继续对话。
- 未来可添加更多 dot，并通过提升单个 dot 的速度或每月可承接的工作量来扩容。

## 核心总结

- <strong>定位</strong>：常驻型个人智能体，由 GPT-6 Astra 驱动，自带云端电脑与浏览器，可连 4,000 多个应用
- <strong>协作</strong>：贯通 ChatGPT、Slack、Teams（短信将至），上下文跨渠道保留，可主动汇报与语音通话
- <strong>自主性</strong>：并行推进多个项目，后台「主动研究」仅用只读工具，敏感动作需批准
- <strong>安全</strong>：独立云电脑与本机隔离、保存密码不进模型、Custom Rules + Activity View + auto-review、监控可叫停
- <strong>企业</strong>：specialist dots 以独立身份承担固定职责，先做企业试点，并与 Microsoft Agent 365 打通治理
- <strong>可用性</strong>：Pro 与 Business Premium 首发，首个 dot 免费包含，对话不占 ChatGPT 用量额度

原文：[Introducing dots](https://openai.com/index/introducing-dots/)（OpenAI，2026-09-30）
