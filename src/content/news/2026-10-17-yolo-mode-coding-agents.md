---
title: "YOLO 模式全解：12 款编程智能体的免确认开关怎么开"
description: "YOLO 模式让编程智能体不再逐步征求同意。梳理 12 款主流智能体的开启方式、折中档位，以及它真正关掉的东西。"
pubDate: 2026-10-17
author: "林晓"
category: "tutorial"
tags: ["YOLO 模式", "编程智能体", "Claude Code", "Codex", "Gemini CLI", "权限审批", "沙箱"]
image: "/covers/2026-10-17-yolo-mode-coding-agents.jpg"
imageAlt: "封面：暖米白手绘笔记本风，居中手写体标题「YOLO 模式全解」，其下是超大墨褐手绘数字 12 与副标题「12 款编程智能体的免确认开关」，画面底部一排手绘拨杆开关，多数拨到开侧并填暖橙色"
topStory: false
---

编程智能体默认会为每个动作征求同意：改一个文件、跑一条命令、发一次网络请求，都要你点一下确认。YOLO 模式就是把这些提示全部关掉的那个开关——名字来自「you only live once」，意思是接受智能体可能做出你原本会拦下的操作，换取不必一直守在旁边。

AgentRQ 在 10 月 2 日发布、10 月 7 日更新的《What Is YOLO Mode? How to Enable It in Every Agent》一文，把 12 款主流编程智能体的开关整理成一张表，并逐条给出命令行参数、配置项与会话内快捷键。本文基于该文写成，其中 Claude Code 部分已对照官方文档核实并补充。

## 它关掉的是什么

智能体之所以带着审批循环（approval loop）出厂，是因为它跑的是真实命令、动的是真实机器。一次典型会话大致是这样：智能体提议 `npm install`，你批准；提议改 `auth.ts`，你批准；想跑测试，你批准。<strong>五十次工具调用就是五十次打断。</strong>

YOLO 模式去掉这些提示，并且视具体实现而定，可能<strong>连限制文件与网络范围的沙箱也一并去掉</strong>。多数智能体还会提供一个折中档：自动批准文件编辑，但执行 shell 命令前仍然询问。

命名上有个耐人寻味的共性——几乎所有厂商都在参数里带上了「dangerously」（危险地），用词本身就在提醒你这意味着什么。

## 一张表：各家的开关

下表转自 AgentRQ 原文。原文说明：所有条目均在 2026 年 10 月 7 日对照官方文档或源码核对过，而这类参数变动很快，使用前建议再确认一次。

| 智能体 | 完全 YOLO | 折中档 | 是否同时关沙箱 |
| --- | --- | --- | --- |
| Claude Code | `claude --dangerously-skip-permissions` | auto 模式、`acceptEdits` | 否 |
| OpenAI Codex CLI | `codex --yolo` | `--sandbox workspace-write` | 是 |
| Google Antigravity | IDE 的 Turbo 预设、`agy --dangerously-skip-permissions` | 默认预设 | Turbo 是；`agy` 参数否 |
| Gemini CLI | `gemini --approval-mode=yolo`、Ctrl+Y | `auto_edit` | 否 |
| GitHub Copilot | `copilot --yolo`、VS Code 的 Allow all | `/permissions assisted` | 否 |
| Cline | 打开全部自动批准开关、`cline --yolo` | 仅安全命令 | 无沙箱 |
| OpenCode | `opencode --auto`、`"permission": "allow"` | 按工具配置规则 | 无沙箱 |
| Kiro | `kiro-cli chat --trust-all-tools` | `--trust-tools`、Autopilot | 无沙箱 |
| Qwen Code | `qwen --approval-mode=yolo` | `auto-edit`、`auto` | 无沙箱 |
| Command Code | `cmd --yolo` | `--accept-edits` | 无沙箱 |
| Kimi CLI | `kimi --yolo`、`/yolo` | 本次会话内允许 | 无沙箱 |
| Pi | 始终开启 | 需安装权限扩展 | 无沙箱 |

表里的「无沙箱」指该智能体本身不提供内置沙箱，因此 YOLO 只是去掉了提示，没有额外拆掉一层限制。

## 逐个看：怎么开、开了会怎样

<strong>Claude Code</strong>：`claude --dangerously-skip-permissions` 等价于 `--permission-mode bypassPermissions`。想设为默认，要在用户级设置里写 `"permissions": {"defaultMode": "bypassPermissions"}`——<strong>项目里的 `.claude/settings.json` 无法启用它</strong>，在其中写入该值时会被忽略，会话仍以手动模式启动。Shift+Tab 只在会话以该模式（或 `--allow-dangerously-skip-permissions`）启动后，才会把 bypass 排进模式循环；`--allow-` 变体只把模式加进循环而不激活它。此外，<strong>deny 规则在任何模式下都生效</strong>，包括 bypass 模式；在 `-p` 无人值守运行时，少数仍会触发提示的调用会被直接拒绝而不是放行。原文推荐的更稳妥选择是 auto 模式：由一个分类器审阅动作，只在遇到高风险操作时才停下——按官方文档，auto 模式从 v2.1.283 起已是交互式终端与 VS Code 会话的内置起始模式。

<strong>Codex</strong>：`codex --yolo` 是 `--dangerously-bypass-approvals-and-sandbox` 的简写，等价于审批策略 `never` 加沙箱 `danger-full-access`。对应配置项为 `approval_policy = "never"` 与 `sandbox_mode = "danger-full-access"`；会话中可用 `/permissions` 切到 Full Access。原文提到 `--full-auto` 已被移除，推荐的默认值改为 `--sandbox workspace-write`。值得注意的是，Codex 这一档<strong>把沙箱也一起去掉了</strong>，而多数其他智能体只关提示。

<strong>Antigravity</strong>：IDE 里的 Turbo 预设既关提示也关沙箱，给到完整文件系统访问；默认预设就是它的折中档，Windows 用户需把终端自动执行设为 Always Proceed。它<strong>没有 `agy --yolo` 这个参数</strong>，要用 `agy --dangerously-skip-permissions`，或在 CLI 设置文件里写 `"toolPermission": "always-proceed"`。注意 CLI 参数只去掉提示，终端沙箱是另一套开关。

<strong>Gemini CLI</strong>：`gemini --approval-mode=yolo`；旧的 `--yolo` 与 `-y` 仍可用但已标记为弃用。会话内按 Ctrl+Y 切换。YOLO 无法在 `settings.json` 里设为默认值，沙箱也仍是独立的 `--sandbox` 参数。原文补充，Google 已把消费级用户迁移到 Antigravity CLI。

<strong>GitHub Copilot</strong>：`copilot --yolo`；`--allow-all` 表示放开全部工具、路径与 URL。会话内用 `/yolo` 或 `/permissions allow-all`。VS Code 里可在权限选择器里选 Allow all、在对话中打 `/yolo`，或设置 `chat.tools.global.autoApprove`，但终端沙箱保持开启。另需区分：Autopilot 是「自己继续往下做」的开关，与是否征求同意无关。

<strong>Cline</strong>：4.1.8 版本移除了那个 YOLO 复选框，原因是没有任何代码读取它。在 VS Code 扩展里，YOLO 现在意味着<strong>逐个打开全部自动批准开关</strong>——读文件、编辑、执行所有命令、浏览器、MCP。CLI 端则仍保留 `cline --yolo`。

<strong>OpenCode</strong>：`opencode --auto`；`--yolo` 与 `--dangerously-skip-permissions` 是隐藏别名。可在 `opencode.json` 里用 `"permission": "allow"` 设为默认，命令面板里也有 Enable auto-approve permissions。它没有沙箱，而且不少工具本来就是默认允许的。

<strong>Kiro</strong>：`kiro-cli chat --trust-all-tools` 或会话内 `/tools trust-all`；IDE 里则是 Autopilot 加允许规则。

<strong>Qwen Code</strong>：`qwen --approval-mode=yolo`、`/approval-mode yolo`，或 Shift+Tab 切换。要留意的是，<strong>这里 Ctrl+Y 并不切换 YOLO</strong>。

<strong>Command Code</strong>：`cmd --yolo` 或 `--dangerously-skip-permissions`；deny 规则依然生效。

<strong>Kimi CLI</strong>：`kimi --yolo` 或 `/yolo`，另有 `--afk` 用来一并免掉它的提问。

<strong>Pi</strong>：它根本没有审批提示，因此可以理解为始终处于 YOLO 状态；`--approve` 管的是「是否信任项目配置」，不是工具调用。要加一道闸，得用 `--tools` 限制可用工具，或安装 `permission-gate` 这类示例扩展——它在 `rm -rf`、`sudo` 之类的命令前先问一句。原文的建议是把它放进容器里跑。

## 沙箱和审批是两件事

把这张表竖着读，会看到一个容易被忽略的区分：<strong>「不再问你」和「不再拦你」不是同一件事。</strong>

Codex 的 `--yolo` 同时拆掉了审批与沙箱；Antigravity 的 Turbo 预设两者都关，但它的 CLI 参数只关审批；Gemini CLI 的沙箱始终是独立的 `--sandbox`；Claude Code 的 bypass 模式不附带沙箱；而 Cline、OpenCode、Kiro、Qwen Code、Command Code、Kimi CLI 与 Pi 压根没有内置沙箱，YOLO 在这些工具里纯粹是去掉提示。

这个区分决定了风险的形状：关掉提示只是让你不再看到将要发生什么，关掉沙箱才是让智能体的可及范围真正扩大。

## 它有多安全

原文给出一句直白的判断：<strong>YOLO 模式的安全程度，等于智能体可能跑出的最坏那条命令的安全程度——而且你不会先看到它。</strong>

真实的风险大多很平庸，而不是戏剧性的：一条 `rm` 打在了错误的目录上；一次迁移跑在了错误的数据库上；一个拼错的依赖名；以及藏在网页或 issue 里的注入指令——智能体读到它们时，可能把它们当成你的要求。

原文给出三条规则：

- <strong>关起来</strong>：放进容器、虚拟机或一次性的克隆里，且不要带生产环境凭证。
- <strong>保持 git 干净</strong>：动手前先提交，这样改动永远离一次 `git reset` 只有一步。
- <strong>限定范围</strong>：只交办一个定义清晰的任务，而不是「把代码库改进一下」。

## 把 YOLO 限定在单个任务上

原文最后介绍了 AgentRQ 自己的做法（该文发表于其官方博客，这一节带有产品介绍性质）。它指出的问题是：<strong>智能体级别的 YOLO 是整场会话的设置</strong>——你为一个无聊任务打开了它，忘了关，下一个任务就继承了它。

它的方案是把 Claude Code 或任意 ACP 智能体经由 ACP Gateway 接到 AgentRQ 工作区，保留智能体自身的审批：权限请求会出现在手机、网页或 Slack 上，由你回答 Allow Once、对该工具 Always Allow，或 Deny。对一个可信任务可以只对该任务开启 YOLO，其他任务照常询问；工具调用历史会记录每一次调用，包括被自动批准的那些。

这个思路本身与具体产品无关，也值得单独记住：<strong>把「免确认」的粒度从会话降到任务</strong>，是比在整场会话里反复开关更不容易出错的默认做法。

## 核心总结

- <strong>定义</strong>：YOLO 模式让智能体不经确认就编辑文件、执行命令；名字取自「you only live once」，几乎每家的参数都带「dangerously」字样
- <strong>关掉的东西</strong>：主要是审批提示；部分实现会连沙箱一起去掉，需要逐家确认
- <strong>关键区分</strong>：「不再问你」不等于「不再拦你」——Codex 的 `--yolo` 同时关沙箱，Gemini CLI 的沙箱始终独立，Claude Code 的 bypass 模式不带沙箱，而 Cline、OpenCode、Kiro、Qwen Code、Command Code、Kimi CLI 与 Pi 本就没有内置沙箱
- <strong>折中档</strong>：多数智能体提供「自动批准编辑、但 shell 命令仍需确认」的中间档位，Claude Code 则另有由分类器把关的 auto 模式
- <strong>Claude Code 细节</strong>：项目级 `.claude/settings.json` 无法启用 bypass 模式；deny 规则在任何模式下都生效；`-p` 无人值守时少数仍会提示的调用会被拒绝而非放行
- <strong>风险</strong>：安全程度等于可能跑出的最坏命令，且你不会先看到它；真实事故多为打错目录、连错数据库、拼错依赖，以及网页或 issue 里的注入指令
- <strong>三条规则</strong>：关进容器或一次性克隆、动手前先提交、一次只交办一个范围明确的任务
- <strong>粒度</strong>：把免确认从「整场会话」降到「单个任务」，比反复手动开关更可靠

原文：[What Is YOLO Mode? How to Enable It in Every Agent](https://agentrq.com/blog/what-is-yolo-mode-and-how-to-turn-it-on-in-every-coding-agent)（AgentRQ Blog，2026-10-02 发布，2026-10-07 更新）

参考：

- [Choose a permission mode](https://code.claude.com/docs/en/permission-modes)（Claude Code 官方文档）
- [Configure permissions](https://code.claude.com/docs/en/permissions)（Claude Code 官方文档）
- [Codex 配置文件参考](https://learn.chatgpt.com/docs/config-file/config-basic)（OpenAI）
