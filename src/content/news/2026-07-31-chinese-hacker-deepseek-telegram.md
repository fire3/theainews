---
title: "中国黑客通过 Telegram 指挥 DeepSeek 发起自主攻击"
description: "Unit 42 披露，一名中文威胁行为者仅凭一条 Telegram 指令，就让 DeepSeek 通过 Hermes Agent 框架自主攻击了 460 多个目标。"
pubDate: 2026-07-31
author: "林晓"
category: "industry"
tags: ["AI 安全", "DeepSeek", "自主攻击", "Hermes Agent"]
image: "/covers/deepseek-telegram.jpg"
imageAlt: "DeepSeek 与 Telegram 结合的自主攻击示意图"
topStory: true
---

Palo Alto Networks 旗下威胁研究团队 Unit 42 披露，一名使用中文的威胁行为者借助开源 Hermes Agent 框架调用 DeepSeek，自主发起网络攻击。

在收到一条 Telegram 初始指令后，该代理自行发现暴露在公网的系统，并挑选了公开可用的漏洞利用代码。研究人员在整个会话中未再发现任何操作者输入。

该操作者通过别名 **knaithe** 和 **KnYuan** 被追踪，以自主流程与常规工作流相结合的方式，对 460 多个目标发起了漏洞利用尝试。

Unit 42 描述了 7 条漏洞利用路径，共涉及 8 个 CVE 编号（因为 n8n 攻击链组合了两个漏洞）。针对 Langflow 和 n8n 的 DeepSeek 自主攻击均告失败，原因是暴露的系统不满足漏洞利用所需的配置条件。

在另一些手动操作中，Unit 42 报告通过 NetScaler 内存越界读取漏洞 CVE-2026-3055 从三家机构窃取了数据，并借助 CVE-2026-39987 在 11 个 Marimo 实例上执行了命令。但报告随后又称，整个行动中只能确认 3 个成功利用的目标，两份表述并未相互印证。The Hacker News 已联系 Palo Alto Networks 求证，收到回复后将更新本文。

该代理会检查版本、下载漏洞利用代码、放弃无效路径，并根据漏洞严重性、受影响系统的部署规模以及可利用性来选择下一个目标。建议各组织修补暴露在外的 Langflow、n8n 与 Marimo 系统，以及配置为 SAML 身份提供方的自管 NetScaler ADC 或 Gateway 设备，同时移除工作流与笔记本界面不必要的公网访问。

Hermes Agent 暴露这次行动的原因，是它从 `/home/worker` 启动了 `python3 -m http.server 8888`。根据该公司的报告，这个意外的 HTTP 服务使操作者的模型配置、API 密钥、漏洞利用脚本、目标清单、shell 历史记录以及自主会话日志全部处于可公开访问状态。

DeepSeek 是 Hermes Agent 内部的主要推理模型，该框架提供了终端访问、可复用技能与无人值守执行能力。Unit 42 还发现了 Claude Code 和 Qwen Code 的少量使用痕迹，并在漏洞利用开发目录中发现了 Codex 的使用迹象，但由于聊天日志未被保留，无法确认其实际使用情况。

![Hermes Agent 通过 Telegram 接收指令的示意图](/images/telegram-ai.jpg)

该框架自己的文档证实，它可以经由 Telegram 运行、执行命令，并调度无人值守任务。

在一次恢复的 2026 年 5 月会话中，DeepSeek 下载了针对 Langflow 代码注入漏洞 CVE-2026-33017 的公开漏洞利用代码，通过 FOFA 枚举了 84 个实例，并找到一个运行 1.3.4 版本的目标。Langflow 是 AI 智能体与工作流构建平台。攻击最终停止，因为目标系统既未启用 `auto_login`，也没有可用的公开流程标识符。

随后，代理调研了 10 类产品，在 GitHub 上搜索最新的 PoC 仓库，并选中了工作流自动化平台 n8n。它组合利用了未授权文件访问漏洞 CVE-2026-21858 与表达式注入问题 CVE-2025-68613。该会话期间，FOFA 返回了中国境内 25,209 个 n8n 系统。

DeepSeek 抽样了约 100 个目标，探测了约 40 个，并识别出 3 个运行受影响版本的实例。其中一个目标暴露了三个表单端点，但全部需要认证；另有 50 多个目标也没有可用的公开表单，因此最终没有任何 n8n 系统被攻破。

关于修复版本：Langflow 在 1.9.0 中修复了 CVE-2026-33017；n8n 在 1.121.0 中修复了 CVE-2026-21858，并在 1.120.4、1.121.1 和 1.122.0 中修复了 CVE-2025-68613，因此 1.121.1 是同时修复攻击链所用两个漏洞的最早版本；Marimo 在 0.23.0 中修复了 CVE-2026-39987。

Citrix 表示，CVE-2026-3055 影响配置为 SAML 身份提供方的自管 NetScaler ADC 与 Gateway 设备。管理员可以检查设备配置中的 `add authentication samlIdPProfile .*` 条目，并安装该公司安全公告中列出的修复版本。

Unit 42 评估该操作者位于中国珠海。公开材料与该评估一致，但无法独立验证：其 GitHub 个人资料显示的名字为 "KnYuan Knaithe"，同一账号下的旧博客则将作者描述为珠海的一名二进制安全研究员。这些资料既不能确定操作者的真实法律身份，也不能证明其与国家有任何关联。

原文：[Chinese Hacker Commands DeepSeek via Telegram to Launch Autonomous Attacks](https://thehackernews.com/2026/07/chinese-hacker-commands-deepseek-via.html)（The Hacker News，作者 Swati Khandelwal）
