---
title: "Codex Security 全景综述：AI 安全代理如何重塑漏洞修复行业"
description: "Codex Security 是 OpenAI 的应用安全代理，从 Aardvark 走向开源，已扫描 3000 万+ 提交、修复 7 万+ 漏洞，推动行业转向补丁自动化。"
pubDate: 2026-08-06
author: "林晓"
category: "industry"
tags: ["OpenAI", "Codex", "应用安全", "漏洞修复", "AI Agent"]
image: "/covers/codex-security-overview.jpg"
imageAlt: "AI 安全代理扫描海量提交并自动修复漏洞的抽象插画"
---

# Codex Security 行业情况综述（2026 年 8 月）

> 本文基于 OpenAI 官方文档与公开资料整理：GitHub 仓库 [openai/codex-security](https://github.com/openai/codex-security)、官方文档 [Codex Security](https://learn.chatgpt.com/docs/security)（含 CLI / 插件 / SDK / 云版全套页面）、Codex 手册中的"审批、沙箱与安全"章节，以及 OpenAI 官方博客（Aardvark 发布、Codex Security 研究预览、Trusted Access for Cyber、Daybreak 等）。文末附完整参考来源。

## 一、是什么：OpenAI 的应用安全代理

Codex Security 是 OpenAI 推出的**应用安全代理（application security agent）**，帮助安全与工程团队"发现、确认并修复代码中的安全漏洞"（[官方概述](https://learn.chatgpt.com/docs/security)）。它的定位不是又一款静态扫描工具，而是把前沿模型的推理能力与自动化验证结合起来，覆盖从漏洞发现到修复验证的完整链路。

它的前身是 **Aardvark**，OpenAI 于 2025 年 10 月以私有测试（private beta）形式发布的"智能体安全研究员"（[Aardvark 发布文](https://openai.com/index/introducing-aardvark/)）；2026 年 3 月 6 日，Aardvark 正式更名为 **Codex Security**，并作为<strong>研究预览（research preview）</strong>向 ChatGPT Pro、Enterprise、Business、Edu 客户开放，首月免费（[研究预览公告](https://openai.com/index/codex-security-now-in-research-preview/)）。2026 年 7 月前后，其 CLI 与 TypeScript SDK 以 `@openai/codex-security` 包公开开源（Apache-2.0），仓库为 [openai/codex-security](https://github.com/openai/codex-security)（[包信息](https://github.com/openai/codex-security/blob/main/sdk/typescript/package.json)）。

产品覆盖四个使用面（[官方概述](https://learn.chatgpt.com/docs/security)）：

| 使用面 | 形态 | 定位 |
| --- | --- | --- |
| ChatGPT 桌面应用 | Codex Security 插件 + Security 工作台 | 扫描、发现、分类、修复、导出等全套工作流，扫描以 Codex 任务方式运行 |
| Codex CLI | `@openai/codex-security` 命令行 | 本地扫描、批量扫描、CI、提交前检查、扫描历史与对比 |
| TypeScript SDK | 同一 npm 包的程序化接口 | 把扫描、进度汇报、成本控制嵌入应用或开发者工具 |
| Codex Security cloud | 连接 GitHub 仓库的云扫描（研究预览） | 按提交持续扫描、威胁模型驱动的云端分析 |

CLI、插件与桌面工作台共用同一套扫描器与结果格式；云版则通过 Codex cloud 扫描已连接的 GitHub 仓库（[官方概述](https://learn.chatgpt.com/docs/security)）。

## 二、工作方式：从威胁模型到可验证补丁

### 1. 分阶段流水线

Codex Security 采用"分析 → 提交扫描 → 验证 → 修补"四阶段流水线（[云版 FAQ](https://learn.chatgpt.com/docs/security/faq)、[Aardvark 发布文](https://openai.com/index/introducing-aardvark/)）：

1. **分析（Analysis）**：对仓库进行整体分析，生成项目专属的**威胁模型**（threat model），概括系统的入口点、信任边界、认证假设、敏感数据路径等。威胁模型以"项目概述"形式保存，可在 [Codex Security scans 页面](https://chatgpt.com/codex/security/scans)中人工编辑，从而影响后续扫描的上下文、排序与优先级（[威胁模型文档](https://learn.chatgpt.com/docs/security/threat-model)）。
2. **提交扫描（Commit scanning）**：从最新提交向历史回溯，结合威胁模型与真实代码上下文，逐提交查找可疑漏洞；初始接入时会回填历史窗口（[云版设置文档](https://learn.chatgpt.com/docs/security/setup)）。
3. **验证（Validation）**：在隔离沙箱中尝试复现高置信度问题，记录命令、退出码、标准输出/错误、测试结果与生成的 diff，作为"验证证据"附加到发现中，以降低误报（[云版 FAQ](https://learn.chatgpt.com/docs/security/faq)）。云版每个分析与验证任务运行在**临时的一次性容器**中，任务结束后即拆除（[云版 FAQ](https://learn.chatgpt.com/docs/security/faq)）。
4. **修补（Patching）**：为发现生成最小化、可审查的补丁建议，由用户审查后以 PR 或补丁文件方式落地。**不会自动改写仓库或自动合入分支**（[云版 FAQ](https://learn.chatgpt.com/docs/security/faq)）。

### 2. 本地扫描能力（插件 / CLI / SDK）

- **标准扫描与深度扫描**：标准扫描适合首次运行与常规巡检；深度扫描（deep scan）投入更多计算资源、搜索范围更广、运行间差异更小，支持仓库级或指定目录，并可通过多智能体并发（`workers`、`subagents`、`stop_after_no_new`、`max_discovery_runs`）控制并发与时长（[深度扫描文档](https://learn.chatgpt.com/docs/security/plugin/deep-scans)）。
- **代码变更审查**：针对 PR、提交、分支区间或本地 patch 的 diff 级安全审查，可自动化接入 CI/CD（[代码变更文档](https://learn.chatgpt.com/docs/security/plugin/code-changes)）。
- **修复与验证**：`$codex-security:fix-finding` 工作流为已接受发现生成聚焦补丁，并在安全可行时添加"修复前失败、修复后通过"的回归测试；测试不安全或不可行时记录证明缺口（proof gap），给出最强可复现验证产物（[修复文档](https://learn.chatgpt.com/docs/security/plugin/fix-findings)）。
- **导出与跟踪**：可将结果导出为 JSON、CSV、SARIF，或准备成 Linear、GitHub Issue、Jira 工单及 GitHub Security Advisory 草稿，写入前需审批并做去重校验（[导出与跟踪文档](https://learn.chatgpt.com/docs/security/plugin/export-findings)）。
- **漏洞报告与安全加固**：`$codex-security:vulnerability-writeup` 可基于扫描结果或外部披露材料撰写自包含漏洞报告；`$codex-security:propose-security-hardening` 从证据中生成结构性加固方案组合（非补丁，需用户明确选择后才会改动仓库）（[漏洞报告文档](https://learn.chatgpt.com/docs/security/plugin/vulnerability-reports)、[安全加固文档](https://learn.chatgpt.com/docs/security/plugin/security-hardening)）。
- **扫描历史与对比**：`scans list/show/rerun/match/compare` 支持按根因自动匹配发现，区分新增、持续、复现、已解决、未知等状态；只有后续扫描完整覆盖原发现位置时才判定"已解决"（[CLI FAQ](https://learn.chatgpt.com/docs/security/cli/faq)）。
- **CI 集成**：官方提供 GitHub Actions 参考工作流，支持 `--diff` 扫描 PR 变更、导出并上传 SARIF 到 GitHub Code Security、`--fail-on-severity` 严重性阈值策略；退出码 0/1/2/130/143 分别表示通过、策略违规、输入/覆盖/运行时错误、中断、终止（[CI 文档](https://learn.chatgpt.com/docs/security/cli/ci)）。
- **批量与容器化扫描**：`bulk-scan` 可从 GitHub 账号/组织发现近 90 天活跃仓库，或从 CSV 清单（固定不可变 commit）执行可恢复的大规模扫描；官方 Docker 镜像与 Compose 配置支持非交互、断点续扫，并默认以非 root 用户运行、丢弃全部 capability、启用 `no-new-privileges` 与自定义 seccomp 策略，Ubuntu 上可选装 AppArmor 加固（[仓库 README](https://github.com/openai/codex-security)）。

### 3. 与 SAST 的关系

官方明确：**Codex Security 不替代 SAST，而是互补**。它提供基于 LLM 的语义推理与自动验证，传统 SAST 仍提供广覆盖的确定性检测；Codex Security 的价值在于缩短"从疑似问题到可复现、带证据与补丁的确认发现"的路径，减少人工分类负担与误报（[云版 FAQ](https://learn.chatgpt.com/docs/security/faq)）。同时它也**不替代人工安全评审**——验证、可利用性判断与威胁评估仍需人来把关（[云版 FAQ](https://learn.chatgpt.com/docs/security/faq)）。

## 三、本地安全模型与信任边界

仓库 [SECURITY.md](https://github.com/openai/codex-security/blob/main/SECURITY.md) 对产品的威胁模型做了非常明确的界定，是理解 Codex Security 安全性的核心文档：

- **以本地操作系统账户权限运行**：只应扫描你信任、且拥有或获明确授权评估的仓库；"有权评估"不等于"可以信任仓库内容"。
- **不是多租户系统**：产品不隔离共享同一 OS 账户、凭据或本地状态的不同用户、任务、仓库或扫描任务；不要把共享的本地状态当作多用户/多租户系统。
- **固定的执行策略**：每次扫描使用 `codex_security_scan` 文件系统 profile 和 `approvalPolicy: "never"`，不请求交互式审批；通过 `--codex` 或 SDK `codexOverrides` 修改 `approval_policy`、`sandbox_mode` 或权限**不会**替换扫描的审批策略或让文件系统 profile 更严格。
- **凭据与隐私**：环境 API 密钥直接传给当前扫描，绝不写入 Codex 凭据目录或系统钥匙串；工作台子进程会移除 `OPENAI_API_KEY`/`CODEX_API_KEY`，但不会移除全部凭据（如 `GITHUB_TOKEN`、`AWS_SECRET_ACCESS_KEY` 可能被本地子进程继承），因此官方建议只传入扫描所需的最小凭据集。
- **安全边界清单**：只有跨越产品实际提供边界的才算安全问题，例如未授权外发凭据/源码/结果、模型或远端输入绕过有效权限、越界写入或网络请求、路径遍历/符号链接/替换文件竞争、伪造或错配的扫描结果、供应链与发布流程被攻陷等；而"攻击者已控制受信仓库/本机/环境"、"提示注入但未越界"、"依赖公告但无可复现影响"等情况通常不在范围内。
- **漏洞披露**：产品漏洞通过 [OpenAI Bugcrowd 项目](https://bugcrowd.com/engagements/openai)私下报告，遵循 OpenAI 的[协调披露政策](https://openai.com/policies/coordinated-vulnerability-disclosure-policy/)与 [CVE 分配政策](https://openai.com/policies/openai-cve-assignment-policy/)；扫描第三方仓库发现的问题应遵循该项目的安全策略，而非报给 OpenAI。

运行建议还包括：把凭据与 Codex home 放在仓库之外、扫描产物（状态、发现、报告、日志、SARIF）存放在 Git 工作树之外、限制结果访问并设置保留期、及时升级包与运行时等（[SECURITY.md](https://github.com/openai/codex-security/blob/main/SECURITY.md)）。

## 四、Codex 本身的纵深防御（沙箱、审批、网络、遥测）

Codex Security 运行在 Codex 之上，因此 Codex 自身的安全机制构成了底座。官方文档（[Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)、[沙箱文档](https://learn.chatgpt.com/docs/sandboxing)）与 OpenAI 内部实践（[Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/)）展示了三层设计：

- **沙箱（技术边界）**：默认 `workspace-write`，本地命令默认关闭网络，写权限限于工作区；macOS 用 Seatbelt、Linux 用 `bwrap` + seccomp、原生 Windows 用专用沙箱实现。`read-only`、`workspace-write`、`danger-full-access` 对应不同自治级别。
- **审批（决策边界）**：`untrusted` / `on-request` / `never` 决定何时需要停下征询；越界编辑、联网等动作需批准。企业可用**自动审批审查（Auto-review）**：由审查智能体按策略评估数据外泄、凭据探测、安全弱化、破坏性动作等风险，低/中风险可自动放行，关键风险拒绝，解析失败时默认失败关闭（fail closed）。
- **网络与策略**：默认无网络；`network_proxy` 可按域名 allowlist 约束出站流量，默认拦截环回、链路本地与私网目标，并做 DNS 重绑定防护；`/.git`、`/.agents`、`/.codex` 等路径在可写根内保持只读保护。
- **可观测性**：OpenTelemetry 日志导出默认关闭、按需开启，覆盖提示词（默认脱敏）、工具审批决策、工具结果、网络代理允许/拒绝等事件；企业可通过 OpenAI Compliance Platform 获取 Codex 活动日志。OpenAI 内部还使用"AI 安全分类代理"结合端点告警与 Codex 日志解释行为意图，供安全团队区分正常行为、良性失误与真正需要升级的事件。

## 五、治理与双重用途：网络安全的行业命题

Codex Security 所处的行业背景是 AI 网络安全能力的高速提升。OpenAI 在 [GPT-5.3-Codex 发布](https://openai.com/index/introducing-gpt-5-3-codex/)与[系统卡](https://openai.com/index/gpt-5-3-codex-system-card/)中披露：

- GPT-5.3-Codex 是**首个在 Preparedness Framework 下被列为"高网络安全能力（High cybersecurity capability）"**的模型，并首次直接训练其识别软件漏洞；CTF 网络安全挑战得分 77.6%，相较 GPT-5.2-Codex（67.4%）明显提升。
- 作为预防措施，OpenAI 训练模型拒绝明显恶意请求（如窃取凭据），并通过**基于分类器的自动化监控**将疑似高风险网络活动路由到能力较弱的 GPT-5.2，再配以产品内提示；误判可通过 `/feedback` 反馈（[Cyber Safety 文档](https://learn.chatgpt.com/docs/cyber-safety)）。
- 同时推出 **Trusted Access for Cyber（TAC）**：个人可在 [chatgpt.com/cyber](https://chatgpt.com/cyber) 验证身份，企业可通过 OpenAI 代表为团队申请；另有面向更高能力模型的邀请制项目。获得信任访问的用户仍须遵守使用政策与条款（[TAC 发布文](https://openai.com/index/trusted-access-for-cyber/)）。

这套治理体系此后持续演进（[TAC 扩展文](https://openai.com/index/scaling-trusted-access-for-cyber-defense/)、[Daybreak 公告](https://openai.com/index/daybreak-securing-the-world/)）：

- 推出为防御场景微调的 **GPT-5.4-Cyber**（降低合法安全工作的拒绝边界、支持二进制逆向等能力），并以分层访问方式发放给通过更强验证（如 KYC）的防御者；2026 年 6 月又发布完整版 **GPT-5.5-Cyber**，在 CyberGym 上达 85.6%（GPT-5.5 为 81.8%），ExploitGym 39.5% vs 25.95%，SEC-bench Pro 69.8% vs 63.1%。
- OpenAI 与澳大利亚、加拿大、法国、德国、日本、韩国、ENISA 等政府和机构建立 TAC 合作关系，并推出 **Daybreak Cyber Partner Program** 让安全厂商在自家产品中合规地使用带 TAC 的前沿模型。
- 配套 1000 万美元 API 额度的**网络安全资助计划**（Cybersecurity Grant Program），以及面向开源维护者的 **Codex for Open Source** 免费扫描计划（已覆盖 1000+ 开源项目）。

行业叙事的转变值得注意：OpenAI 认为，AI 已把**漏洞发现**的门槛大幅拉低，瓶颈正从"发现问题"转向"打补丁"——Daybreak 明确把目标定义为"以机器速度实现端到端补丁自动化"，并与 Trail of Bits、HackerOne、Calif 共同发起 **Patch the Planet**，让资深研究员结合 Codex Security 直接协助 cURL、Go、Python、Sigstore、pyca/cryptography 等 30+ 开源项目从发现走向修复（[Daybreak 公告](https://openai.com/index/daybreak-securing-the-world/)）。

## 六、规模化数据：行业影响的可量化证据

官方披露的规模化数据是目前最有力的行业信号：

| 时间/阶段 | 数据 | 来源 |
| --- | --- | --- |
| Aardvark 私测 | 在"黄金仓库"基准上识别出 92% 的已知与人工注入漏洞；约 1.2% 的提交会引入 bug；2024 年全年新增 CVE 超 4 万 | [Aardvark 发布文](https://openai.com/index/introducing-aardvark/) |
| 研究预览前 30 天（外部 beta 队列） | 扫描超 120 万次提交；792 个 critical、10,561 个 high 发现；critical 出现在 <0.1% 的提交中 | [研究预览公告](https://openai.com/index/codex-security-now-in-research-preview/) |
| 同一期间的精度改进 | 单一仓库噪声下降 84%；严重性高报率下降 90%+；全仓库误报率下降 50%+ | [研究预览公告](https://openai.com/index/codex-security-now-in-research-preview/) |
| 研究预览上线以来（截至 2026 年 6 月） | 扫描超 3000 万次提交、覆盖 3 万+ 代码库；人工标记修复 7 万+ 条发现；另有 50 万+ 条被自动判定为已修复 | [Daybreak 公告](https://openai.com/index/daybreak-securing-the-world/) |
| 同一时期 | Codex Security 参与修复 critical/high 漏洞 3000+，另有大量低严重级修复 | [TAC 扩展文](https://openai.com/index/scaling-trusted-access-for-cyber-defense/) |

在开源生态方面，Codex Security 向 OpenSSH、GnuTLS、GOGS、Thorium、libssh、PHP、Chromium 等广泛使用的项目报告了高危漏洞，累计获分配 14 个 CVE（其中 2 个为双重报告），并已帮助 vLLM 等项目在日常流程中完成发现与修复（[研究预览公告](https://openai.com/index/codex-security-now-in-research-preview/)）。

## 七、开源与生态开放性

Codex Security 的开源是 2026 年 7 月行业关注度很高的动作：CLI/SDK 以 [Apache-2.0](https://github.com/openai/codex-security/blob/main/LICENSE) 发布，npm 包 `@openai/codex-security` 公开可用（当前仓库版本 0.1.7），支持 macOS、Linux、Windows，要求 Node.js 22.13+/24/26 与 Python 3.10+（[SDK README](https://github.com/openai/codex-security/blob/main/sdk/typescript/README.md)）。仓库通过单向镜像发布，不接受外部 PR 直接合入，但欢迎 issue 与反馈（[CONTRIBUTING](https://github.com/openai/codex-security/blob/main/CONTRIBUTING.md)）。

值得注意的开放性设计：

- **默认模型与可替换推理提供商**：扫描默认使用 `gpt-5.6-sol`（extra-high 推理强度），可切换 `gpt-5.6-terra` 等模型，也可通过 `--provider` 接 OpenRouter、Fireworks、Amazon Bedrock 等第三方推理提供商（[SDK README](https://github.com/openai/codex-security/blob/main/sdk/typescript/README.md)）。
- **工具链互操作**：支持 SARIF 导出与 GitHub Code Security 上传、CodeQL 查询、GitHub CLI 发现仓库、Linear/GitHub/Jira 工单跟踪；CLI 还可用 `mcp add` 注册为只读 MCP 服务器、生成 shell 补全（[SDK README](https://github.com/openai/codex-security/blob/main/sdk/typescript/README.md)）。
- **持续迭代**：插件版本更新频繁（截至 2026 年 8 月 5 日最新为 0.1.17），新增实时进度跟踪、中断深度扫描续跑、按实测 token 用量计费等能力（[插件更新日志](https://learn.chatgpt.com/docs/security/plugin/changelog)）。

## 八、小结与展望

综合来看，Codex Security 的行业图景可以概括为三点：

1. **从"安全扫描工具"到"安全工程师伙伴"**：产品围绕"威胁模型 + 自动验证 + 可审查补丁 + 人在环路"设计，目标是给每个开发者旁边放一位"安全工程师"，把发现、验证、修复的证据链串起来，而不是继续堆叠告警。
2. **发现与修复并重、逐步转向修复**：官方数据反复强调误报率下降与修复量上升；Daybreak 更把"补丁自动化"定义为核心方向。对安全行业而言，AI 带来的不是更多报告，而是把报告转化为已确认、已修复结果的规模化能力。
3. **能力越强，治理越严**：随着模型在网络能力上达到"高"等级，OpenAI 同步部署了安全训练、分类器监控、信任访问（TAC）、威胁情报与执法联动等分层防线，并把防御者优先作为产品与政策的主线。可以预期，Codex Security 及其生态会沿着"精度持续提升、覆盖面扩大、补丁链路自动化、可信访问体系化"四个方向继续演进。

## 参考来源

**产品与文档**

- [Codex Security 官方概述（learn.chatgpt.com/docs/security）](https://learn.chatgpt.com/docs/security)
- [GitHub：openai/codex-security（README）](https://github.com/openai/codex-security)
- [GitHub：Codex Security 安全政策（SECURITY.md）](https://github.com/openai/codex-security/blob/main/SECURITY.md)
- [GitHub：TypeScript SDK / CLI 包说明](https://github.com/openai/codex-security/blob/main/sdk/typescript/README.md)
- [Codex Security CLI FAQ](https://learn.chatgpt.com/docs/security/cli/faq)
- [Codex Security 云版 FAQ](https://learn.chatgpt.com/docs/security/faq)
- [Codex Security 云版设置](https://learn.chatgpt.com/docs/security/setup)
- [Codex Security 威胁模型](https://learn.chatgpt.com/docs/security/threat-model)
- [Codex Security 深度扫描](https://learn.chatgpt.com/docs/security/plugin/deep-scans)
- [Codex Security CI 集成](https://learn.chatgpt.com/docs/security/cli/ci)
- [Codex Security 修复与验证](https://learn.chatgpt.com/docs/security/plugin/fix-findings)
- [Codex Security 导出与跟踪](https://learn.chatgpt.com/docs/security/plugin/export-findings)
- [Codex Security 插件更新日志](https://learn.chatgpt.com/docs/security/plugin/changelog)
- [Codex 手册：Agent approvals & security](https://learn.chatgpt.com/docs/agent-approvals-security)
- [Codex 手册：沙箱](https://learn.chatgpt.com/docs/sandboxing)
- [Codex 手册：Cyber Safety](https://learn.chatgpt.com/docs/cyber-safety)

**官方公告与博客**

- [Introducing Aardvark: OpenAI's agentic security researcher](https://openai.com/index/introducing-aardvark/)
- [Codex Security: now in research preview](https://openai.com/index/codex-security-now-in-research-preview/)
- [Introducing GPT-5.3-Codex](https://openai.com/index/introducing-gpt-5-3-codex/)
- [GPT-5.3-Codex System Card](https://openai.com/index/gpt-5-3-codex-system-card/)
- [Introducing Trusted Access for Cyber](https://openai.com/index/trusted-access-for-cyber/)
- [Trusted access for the next era of cyber defense](https://openai.com/index/scaling-trusted-access-for-cyber-defense/)
- [Strengthening cyber resilience as AI capabilities advance](https://openai.com/index/strengthening-cyber-resilience/)
- [Running Codex safely at OpenAI](https://openai.com/index/running-codex-safely/)
- [Daybreak: Tools for securing every organization in the world](https://openai.com/index/daybreak-securing-the-world/)

**政策与其他**

- [OpenAI Bugcrowd 漏洞奖励项目](https://bugcrowd.com/engagements/openai)
- [OpenAI 协调披露政策](https://openai.com/policies/coordinated-vulnerability-disclosure-policy/)
- [OpenAI CVE 分配政策](https://openai.com/policies/openai-cve-assignment-policy/)
- [OpenAI 信任中心（含 Codex 安全白皮书）](https://trust.openai.com/)
