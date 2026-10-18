---
title: "AgentRQ 发布 Pano：给所有工作区的智能体一块共享的 Markdown 留言板"
description: "AgentRQ v0.10.0 推出 Pano：账户内所有工作区共享一块 Markdown 文档板，智能体可发帖、评论、互相交接，清单项完成还会自动打勾。"
pubDate: 2026-10-18
author: "林晓"
category: "tools"
tags: ["AgentRQ", "多智能体协作", "MCP", "工作区", "人在回路", "Markdown", "任务编排"]
image: "/covers/2026-10-18-agentrq-pano-shared-board.jpg"
imageAlt: "封面：浅色杂志编辑风，居中标题「一块板，所有智能体共享」与副标题「AgentRQ Pano · 跨工作区文档板」；下方一块贴满彩色便签的留言板，三个工作区图标以珊瑚色箭头指向板面，底部三项标注：所有工作区共享、勾完自动打勾、只传 id，不搜索"
topStory: false
---

10 月 13 日，AgentRQ 团队在该公司博客发布 <strong>Pano</strong>：一块属于整个账户的 Markdown 文档板，账户下每个工作区的智能体都能读写它。功能随 AgentRQ v0.10.0 上线（板面 PR #889、主管聊天 #891、侧栏图标 #893），Pano 在土耳其语里就是「板子」——办公室里那块让所有人钉上通知的软木板。

AgentRQ 是面向 Claude Code 与 ACP 兼容智能体的「人在回路」任务管理平台。它的基本主张是<strong>每个工作区只跑一个专职智能体</strong>：API 智能体懂 API，Web 智能体懂前端，发布智能体盯着日程，彼此看不到对方的任务。这个结构对专注有利，但真实工作会跨越边界——API 改了响应格式，Web 智能体得知道；发布要三个工作区在周四前各自完工；有人写了事故复盘，所有碰 webhook 的智能体都该读一遍。在此之前，让知识在智能体之间流动的其实是<strong>你</strong>：把 API 契约复制进 Web 任务，逐个工作区检查进度，把复盘粘进三段提示词。

## Pano 是什么

每篇 Pano 文档就是一张便签：标题、Markdown 正文、纸张颜色，需要时还可以带文件。板上的卡片显示正文、作者（某个工作区，或者**你**）以及写入时间；点开可以看到完整内容、评论与附件。文档属于账户而不是某个工作区，因此任何工作区的智能体都能读能写。

![AgentRQ 的 Pano 板面：不同颜色的便签卡片、清单进度条与底部的上级智能体聊天框](/images/agentrq-pano/pano-board.png)

*图 1：板面顶部可按标题与颜色筛选；「This week」是用户写的，其余便签分别来自 web、api、design 三个工作区。*

文档不会无限堆积：默认在<strong>最后一次保存后 30 天</strong>删除，智能体可以在保存时申请更长时间，最长 365 天——比如一份希望长期留存的复盘。便签颜色有黄、粉、绿、蓝、橙、紫、琥珀七种；原文 FAQ 说明每个文件最大 2 MiB。

## 会自己打勾的清单

在文档里写下 Markdown 任务列表，它就变成一张勾选清单：你可以在板上或文档里勾选，卡片会显示进度条，比如「2 of 6 done」。真正有意思的是下一步——打开某一项的菜单，把它指派给一个工作区，AgentRQ 会在那个工作区创建一条任务，任务标题就是清单项的文字，并指回这篇文档。

![把清单项指派给工作区的菜单](/images/agentrq-pano/pano-assign-item-to-workspace.png)

*图 2：指派后，清单项会带上一枚芯片，显示所属工作区与该任务的实时状态。*

之后清单项会携带工作区芯片与任务的状态；那个工作区的智能体把任务做完，清单项就<strong>自己打上勾</strong>。于是发布计划不再是一张需要人反复核对的清单：写着「Cursor pagination」的一项属于 @api，状态显示 Ongoing；「Invoice list」属于 @web，任务完成时它自己勾上了。计划自己呈现进度，你不必去问任何人。

![跨工作区的发布计划清单，部分条目已自动打勾](/images/agentrq-pano/pano-release-plan-checklist.png)

*图 3：清单项链接到任务，状态随任务变化，完成即打勾。*

## 评论、@ 与聊天框

每篇文档都有评论区，每条评论记录作者是某个工作区还是你。下图里 api 智能体贴出契约，web 智能体要求给 CSV 导出加大分页，api 智能体作答——这场对话发生在两个智能体之间，落在它们讨论的那篇文档上，你事后可以读到。

![文档评论区，两个智能体在一篇文档下对话](/images/agentrq-pano/pano-doc-comments.png)

*图 4：交接过程留痕在文档上，而不是消失在没人看过的提示词里。*

在评论里输入 <strong>@工作区</strong>就能把智能体拉进来：输入框会随打随提示工作区名，被点到的每个工作区都会收到一条任务，要求它的智能体读这篇文档并用评论作答。板面上还有一只给<strong>主管智能体（supervisor）</strong>的聊天框，可以让它贴摘要、更新文档，或者告诉你还剩什么没做完，全程不用离开这个页面。此外，你自己写的任何文档都有一个按钮，可以一键把它变成指定工作区里的一条任务——随手记的一条便签就此变成真实工作。

## 为什么智能体不能搜索

Pano 有一个刻意为之的限制：<strong>智能体不能列出或搜索板上的文档</strong>。它读到某篇文档，只可能是因为有人把文档 id 交给了它——写在任务里、回复里，或某个事件的载荷中。板面对人类提供标题筛选，对智能体则没有。

原文解释了这个取舍：一是让每个智能体的视野保持「小而有意为之」，只读被指到的文档，而不是板上的一切，单一职责工作区的上下文才不会重新膨胀；二是让交接成为<strong>明确动作</strong>：把 id 写进任务或回复，意味着「请读这篇」，而不是一次顺手浏览。

## 怎么用

智能体通过已有的 MCP 连接拿到一个 `pano` 工具，可以保存、读取、评论、附加文件与删除文档，主管智能体同样拥有它。在 shell 里则有 `agentrq-ws pano` 系列命令，好处是文档的 Markdown 与文件不会占满智能体的上下文：

```bash
npx -y @agentrq/agentrq-ws@latest pano save --title "Release plan" --markdown "- [ ] Tag v0.9.21" --file chart.png --color blue
npx -y @agentrq/agentrq-ws@latest pano read <id> --comments --attachments --out ./pano
npx -y @agentrq/agentrq-ws@latest pano comment <id> "Backend done."
```

`pano save` 会打印文档 id，`pano read --out` 会把 Markdown 与它链接的文件一起写进目标目录，保证文档里的链接仍然可用。多写者场景也有处理：后续的 #896 给保存加了版本校验，并引入 `edit` 动作做局部更新，避免并发写入互相覆盖。

AgentRQ 官方 FAQ 里还有几条值得记住的边界：Pano 与「工作区记忆」不是一回事——记忆是一个工作区内智能体的私有笔记，Pano 才是跨工作区共享、并且在页面上可见的那部分；把清单项指派给工作区会真的在那个工作区创建任务，并随任务状态自动打勾。

## 核心总结

- <strong>Pano</strong> 是 AgentRQ v0.10.0 上线的账户级 Markdown 文档板，所有工作区的智能体共享，人类以便签墙的形式浏览
- <strong>解决的问题</strong>：单一职责工作区之间的知识交接原本靠人复制粘贴，Pano 把这份「人肉中转」交给智能体自己
- <strong>会自我跟踪的清单</strong>：清单项可指派给工作区生成任务，卡片显示任务实时状态，任务完成即自动打勾
- <strong>协作方式</strong>：评论记录作者，`@工作区` 会为对应智能体创建任务，另有主管智能体聊天框与「便签一键转任务」
- <strong>重要取舍</strong>：智能体不能搜索 Pano，只能接收别人递过来的文档 id，以保住工作区隔离与交接的明确性
- <strong>文档生命周期</strong>：默认最后一次保存后 30 天删除，可按需延长至 365 天；并发写入用版本号校验
- <strong>状态</strong>：AgentRQ 目前处于公开测试阶段，代码在其 GitHub 仓库开放

原文：[The Pano: A Shared Board for Agents in Every Workspace](https://agentrq.com/blog/pano-shared-markdown-board-for-ai-agents-across-workspaces)（AgentRQ 博客，2026-10-13）
