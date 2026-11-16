---
title: "Claude-Red 与 Claude-BugHunter：把 Claude 改造成安全测试操作员的开源技能包"
description: "开源社区把 Claude 改造成安全测试操作员：claude-red 以 78 个技能覆盖 23 类攻击面，Claude-BugHunter 用 83 个技能与 681 份公开漏洞报告模式聚焦外部攻击面，均以授权测试为前提。"
pubDate: 2026-11-16
author: "林晓"
category: "tools"
tags: ["Claude", "Agent Skills", "网络安全", "红队", "渗透测试", "开源"]
image: "/covers/2026-11-16-claude-security-skill-packs.jpg"
imageAlt: "封面：工程蓝图风分栏对比，左栏 claude-red、右栏 Claude-BugHunter，主标题「把 Claude 变成红队操作员」"
topStory: false
---

Agent Skills 生态正在从编码延伸到安全测试。GitHub 上近期有两个高星开源项目走红：SnailSploit 的 claude-red（约 1.1 万 Star）以广度见长，用 78 个技能覆盖 23 类攻击面；elementalsouls 的 Claude-BugHunter（约 7,100 Star）则以纪律见长，把 681 份公开漏洞赏金报告的模式整理成 83 个技能，并内置范围控制与提交前验证门。两者都是纯 Markdown 的 SKILL.md 文件集合，MIT 或 CC BY 4.0 许可，且都明确声明只面向拥有授权的测试场景。

## 共同底座：SKILL.md 与按需加载

两个项目的机制一致：每个技能是一个结构化的 SKILL.md 文件，前置元数据声明触发条件，Claude 运行时按对话主题自动加载匹配技能——提到 SQL 注入就加载对应的注入方法论，不调用就不占用上下文窗口。差异在于装进什么：claude-red 直接把仓库克隆到 `~/.claude/skills/`；Claude-BugHunter 提供 Claude Code 插件市场安装（`/plugin marketplace add`）、复制安装两种方式，还有 `cbh` 命令行编排器与 Burp Suite MCP 集成，安装脚本可同时把技能分发到 OpenCode、OpenAI Codex CLI、Hermes Agent 等五种智能体运行时。

## claude-red：广度优先，23 类攻击面

![claude-red 项目横幅](/images/claude-red-banner.png)

claude-red 的定位是「上下文感知的红队操作员」技能库，覆盖面明显更宽：Web 应用 16 个技能（注入、XSS、SSRF、反序列化、请求走私、业务逻辑等）、无线 14 个（WPA2/WPA3、蓝牙 BLE、Zigbee、Z-Wave、LoRaWAN）、漏洞利用开发 6 个（栈/堆溢出、ROP、缓解机制绕过）、容器与 Kubernetes、CI/CD 管道、供应链、社会工程、后渗透（横向移动、持久化、数据外带）、取证与 C2，甚至包含 AI 安全（提示注入、RAG 投毒）。项目路线图显示目标扩到约 130 个技能。作者 Kai Aizen，许多技能建立在 sahar042 公开的 offensive-checklist 清单之上。

## Claude-BugHunter：纪律优先，聚焦外部攻击面

![Claude-BugHunter 项目横幅](/images/claude-bughunter-banner.svg)

作者 Sachin Sharma 把自己漏洞赏金与授权红队实战中暴露的九类能力缺口整理成四层技能栈：方法论层（假设驱动的工作流、红队操作纪律）、Web 漏洞层（58 个 hunt-* 技能，提炼自 681 份 HackerOne 公开报告，其中 433 份逐条引用可溯源）、企业平台层（M365/Entra、Okta、vCenter、SSL-VPN 设备的 2024–2026 CVE 链）、交付层（VRT 感知的严重性定级、PII 脱敏的证据卫生、面向客户的红队报告模板）。工作流为六阶段非线性流程——侦察、测绘排序、狩猎、验证、报告，提交前有「七问门」强制校验，包括资产是否在范围内、影响是否在项目允许清单上。

值得注意的是它的排除清单是刻意设计：内部 Active Directory 攻击、C2 框架、后渗透持久化、免杀都不在范围内，作者明言「宁可事先说清，也不让你在项目中途才发现」——这些恰是 claude-red 覆盖的部分。

## 怎么选

| 维度 | claude-red | Claude-BugHunter |
| --- | --- | --- |
| 定位 | 全谱系攻击面技能库 | 外部攻击面 + 漏洞赏金流程 |
| 规模 | 78 技能 / 23 类（目标 130） | 83 技能 / 15 个斜杠命令 |
| 数据来源 | offensive-checklist 清单 | 681 份 H1 公开报告，逐条引用 |
| 独有覆盖 | 内网 AD、无线、后渗透、免杀、漏洞利用开发 | 企业平台 CVE 链、VRT 定级、证据卫生、七问门 |
| 工程化 | 稀疏检出按类安装、安装脚本 | 插件市场、cbh CLI、Burp MCP、五运行时分发 |
| 许可 | MIT | 代码 MIT / 内容 CC BY 4.0 |

简单说：做漏洞赏金和对外部资产的授权测试，Claude-BugHunter 的流程约束与报告能力更贴合；需要在内网 AD、无线或后渗透阶段补充方法论，claude-red 覆盖更全。两者安装并不互斥。

## 绕不开的护栏问题

两个项目都把「授权」写进文档，但也绕不开模型侧的限制。Claude-BugHunter 专门提醒：Anthropic 的实时网络安全护栏默认拦截「漏洞利用与攻击性安全工具开发」，即使授权范围内的请求也可能被拒，正规渠道是申请免费的 Cyber Verification Program；另外在 Opus 5 上，利用生成、二进制漏洞扫描、渗透测试等高风险请求不会拒绝，而是静默降级到 Opus 4.8 应答——长时间智能体运行中容易漏看提示。该项目的 /hunt 命令会在首轮显式声明「授权、限定范围、可修复发现」的语境，正是为了对齐护栏判定。

安全从业者是这批项目的目标用户，但技能包本身只提供方法论框架，不改变授权边界——模型护栏、项目范围声明与使用者资质构成的三重约束，缺一不可。

## 核心总结

- 两个高星开源项目都用 Agent Skills 把安全测试方法论装进 Claude：claude-red 约 1.1 万 Star，Claude-BugHunter 约 7,100 Star
- claude-red 广度优先：78 个技能覆盖 Web、无线、AD、后渗透、免杀到 AI 安全的 23 类，目标扩至 130 个
- Claude-BugHunter 纪律优先：681 份公开报告提炼模式，六阶段流程加七问验证门，聚焦外部攻击面并明确排除内网与 C2
- 工程化程度不同：后者有插件市场、cbh CLI、Burp MCP 与五种运行时分发
- 模型侧护栏（实时拦截、CVP 认证、Opus 5 降级应答）是使用时必须了解的现实约束，授权是两者的共同前提

参考：

- [SnailSploit/claude-red - GitHub](https://github.com/SnailSploit/Claude-Red)
- [elementalsouls/Claude-BugHunter - GitHub](https://github.com/elementalsouls/Claude-BugHunter)
- [Anthropic：Claude 实时网络安全护栏说明](https://support.claude.com/en/articles/14604842-real-time-cyber-safeguards-on-claude)
- [Anthropic：Opus 5 会话中的模型切换机制](https://support.claude.com/en/articles/16049681-why-claude-switched-models-in-your-conversation-with-opus-5)
