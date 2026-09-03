---
title: "Hugging Face 开源 Funes：克隆给你手头的编码智能体加一份「记忆」"
description: "Hugging Face 发布开源的编码智能体记忆层 Funes：把已在本机的会话记录索引成可检索记忆，支持 Claude Code、Codex、pi、Hermes，可与 Hub 数据集同步、本地推理、私密默认。"
pubDate: 2026-09-03
author: "林晓"
category: "tools"
tags: ["Hugging Face", "Funes", "Agent", "编码智能体", "记忆", "开源", "Claude Code"]
image: "/covers/2026-09-03-huggingface-funes-memory.jpg"
imageAlt: "Funes 封面：深海军蓝渐变背景配琥珀橙节点的记忆检索光路，标题「给编码智能体一份记忆」"
topStory: true
---

9 月 3 日，Hugging Face 开源 **Funes**——一个面向编码智能体的「记忆层」（memory layer）。它的理念是：**会话记录（traces）只是档案，只有当它们被索引、检索、排序并带上精确出处时，才谈得上记忆**。Funes 直接复用你本机已有的会话数据，一条命令就能接入现有智能体的日常工作流，让记忆成为本地、私密、可随你迁移的「数据资产」。

## 通用记忆，而非另一种记忆服务

Funes 采用单一二进制分发，默认推理后端**不依赖任何机器学习运行时**——嵌入与重排在本地完成。安装后即可接入智能体：

```bash
curl -fsSL https://huggingface.co/buckets/huggingface/funes/resolve/install.sh | sh
funes add claude    # 或：codex、pi、hermes
```

`add` 这步命令会为你完成三件事：建立首个索引、给智能体配备 `recall` 与 `get` 工具、安装「每完成一轮 turn 就增量索引」的自动化。此后任务触及过去的决策、理由或结论时，智能体会**主动在会话内调用 `recall`**，并注明答案来自哪段会话——而 `recall` 返回的是**原文而非摘要**，每条结果都会给出打开对应上下文回合的 `get` 命令。无需你再回忆旧会话、手动粘贴上下文。

Funes 的设计由此带来三个关键特性：

- **跨智能体通用记忆**：Claude Code、Codex、pi、Hermes 写入统一的「回合-块」结构，`recall` 能跨它们的全部历史检索，并标明每条命中来自哪个智能体；
- **保留原始证据**：写入时不把任何事实蒸馏成单点结论，任何结果都能回溯到产生它的回合；
- **本地默认真实**：不需要账号或 Hub 仓库，嵌入与重排都在本机完成，托管模型不会处理你的会话内容。

底层是一条确定性的流水线：它把受支持的 trace 解析成统一的「回合-块」形态，分块后用固定的本地模型嵌入，写入本地 **Lance 数据集**。查询时结合**向量与 BM25 检索**、融合排序、用 **cross-encoder 重排**、按**新旧程度加权**，并附加相邻块。

## 记忆是一份数据集，而不是一项服务

Funes 的关键设计判断是：**记忆是数据集，不是服务**（"A memory is a dataset, not a service"）。绑定共享记忆只需一行命令：

```bash
funes add codex acme/funes-memory
```

绑定后，本地按 turn 增量索引，并在**会话边界**把记忆发布到你拥有的 **Hugging Face 数据集**（默认私有）；在另一台机器上执行同样命令，记忆便随你迁移，Hub 负责所有权、访问控制、版本化与分发——你不会被绑定在某个记忆服务的账号里，也不需要为它租用 API。

敏感信息在源头就得到处理：**凭据在索引阶段已被脱敏**，发布前还会再次逐块扫描，拒收任何仍像密钥的内容（对应扫描器在仓库 `SECURITY.md` 中有说明）。远程记忆读取时，Funes 会**本地缓存数据集文件**，让热查询恢复到本地速度。

对想先试水的用户，还有只读的单问版 **`funes ask`**：它读取本地记忆（默认）或指定共享记忆，把命中的段落交给编码智能体，返回**注明来源的依据性回答**——且不安装任何集成、不改变智能体的持久配置：

```bash
funes ask claude "why is funes append-only" --memory huggingface/funes-memory
```

官方还发布了一份 **Funes 开发过程的记忆**（`huggingface/funes-memory`），任何人无需自己建记忆，即可直接询问「Funes 为什么这样工作」。

## 切换智能体不再断线

共享记忆不与创建它的智能体或模型绑定。同一任务可以今天在 Claude Code 里开始、下周在 Codex 里继续，后者照样能 `recall` 前者的推理过程；本地模型或 Hub router 托管的模型搭配 pi 使用后，也能切回 Claude。

这在几个场景中尤为有价值：

- **跨设备**：把每个智能体绑定到同一份记忆，无论在哪台机器上都能调用历史；
- **跨团队**：新同事的智能体第一天就能检索几个月的决策——包括从未写进 pull request 的死路与理由；
- **开源项目**：维护者可以把一次发布背后的会话直接发布出来。官方形象地称之为「**可检索的 CLAUDE.md**」——记录项目「为什么长这样」的完整历史，且随时可被另一个智能体查询、溯源回产生它的会话。

发布到 Hub 的记忆会携带数据集卡片与 **funes 标签**，便于识别和发现。在 HF 官方看来，Hub 已经托管开源权重与数据集，**Funes 补上了「开源的工作记忆」这一块**。

## 是否值得离开昂贵的上下文

针对**长会话膨胀**这一痛点，Funes 把 `recall` 视作「压缩后继续」与「写交接文档后重开」之外的第三种出路，并在 **handoff-vs-recall 基准**上用两个「没有会话先验知识就无法重建答案」的任务做了测度：

- **压缩（compaction）**：智能体默认方案，也是三者中唯一结果分裂的——一个任务成功、另一个失败，失败处的摘要把关键发现给「抹平」了；而 recall 返回的是段落原文，发现不需要经历摘要而存活；
- **recall 成本最低**：两项任务上，它分别比书面交接**便宜 8 倍与 4 倍**。

> 「思考就是忘记差异、做概括、进行抽象。」
> —— 豪尔赫·路易斯·博尔赫斯，《博闻强记的富内斯》

## 基于开源构建

Funes 本身也是开源的（`github.com/huggingface/funes`）。它不多发明东西：大量依赖**足以本地运行的开放嵌入模型**、Lance 的**追加式数据集**带来的廉价增量写入，以及 Hub 对数据集的**缓存与内容去重**——真正的功夫在于把它们组装成一个智能体真正能用的记忆。

原文：[Give Your Coding Agents a Memory You Own](https://huggingface.co/blog/funes)（Hugging Face Blog，2026-09-03）

项目与资源：[GitHub](https://github.com/huggingface/funes) · [Funes 开发记忆数据集](https://huggingface.co/datasets/huggingface/funes-memory) · [handoff-vs-recall 基准](https://huggingface.co/datasets/dacorvo/funes-handoff-recall-benchmark)
