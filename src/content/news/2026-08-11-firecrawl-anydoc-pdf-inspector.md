---
title: "Firecrawl 开源 AnyDoc：一个库把 14 种文档格式统一转成 Markdown"
description: "Firecrawl 开源 Rust 库 AnyDoc，无 API Key、零依赖地把 Word、Excel、PPT 等 14 种格式统一转成 Markdown，实测中位耗时 4.4 毫秒。"
pubDate: 2026-08-11
author: "林晓"
category: "tools"
tags: ["Firecrawl", "AnyDoc", "文档解析", "开源", "RAG", "Markdown"]
image: "/covers/2026-08-11-firecrawl-anydoc-pdf-inspector.jpg"
imageAlt: "浅色杂志风封面：14 种文档格式图标汇聚为统一 Markdown 输出，标注 4.4ms 中位耗时与 81 分盲评质量"
---

8 月 6 日，Firecrawl 宣布开源两套文档解析库：pdf-inspector 专注 PDF，AnyDoc 处理其余格式。AnyDoc 号称用单个零依赖的 Rust 库覆盖 Word、Excel、PowerPoint、OpenDocument、RTF、EPUB、CSV 等 14 种格式，统一输出 GitHub Flavored Markdown，中位转换耗时仅 4.4 毫秒，无需 API Key、无需系统依赖。

## 14 种格式，一个文档模型

AnyDoc 的核心设计是「一个模型、统一输出」：每种格式先解析进同一个文档结构模型，再经由同一个 Markdown 序列化器输出，因此标题、嵌套列表、合并单元格、脚注等结构在不同格式间的表现完全一致——无论是 2003 年的 .doc 还是昨天的 .pptx。

- **格式检测看内容不看扩展名**：通过 PDF 文件头、RTF 起始标记、OLE 流名、ZIP mimetype 等识别真实格式，扩展名被改错也能正确转换（CSV 没有文件签名，需要扩展名或显式指定）
- **多语言绑定**：提供 Rust、Node.js、Python、浏览器 WebAssembly 和 CLI 五种用法，API 完全一致；浏览器版编译为 WASM，文件在本地转换、不出本机
- **Agent 就绪**：附带 Agent Skill（`npx skills add firecrawl/anydoc`），Claude Code、Codex、Cursor 等智能体可直接读取 Office 文档
- **PDF 内置支持**：文本型 PDF 通过内置的 pdf-inspector 在本地转换；扫描页则需要另行接入 OCR（Firecrawl 的托管 Parse API 提供）

## pdf-inspector：PDF 解析的智能路由层

pdf-inspector 是同一批发布的另一款 Rust 库，GitHub 上已有 1.3 万星。它不渲染页面，而是毫秒级读取 PDF 内部结构（字体编码、文本运算符、图片覆盖），逐页判断内容是文本还是需要 OCR：

- 文本页直接原生抽取，保留阅读顺序
- 扫描或图片为主的页面被标记并给出原因，交给视觉/OCR 管线处理

这个「路由层」正是很多 PDF 管线做错的地方——默认把每一页都当扫描件，全部送进 OCR，又慢又贵。pdf-inspector 让 Firecrawl 的托管解析引擎 Fire-PDF 比旧管线快 3.5–5 倍：一份 200 页的报告如果 150 页是纯文本，这 150 页完全跳过 GPU。

## 基准测试：4.4ms 与 81 分

Firecrawl 将 AnyDoc 与六个转换器在 100 份真实文档上做了对比，覆盖全部 14 种格式：

- **覆盖率**：14/14。AnyDoc 是测试中唯一解析全部格式的库，最接近的 LibreOffice 只覆盖 12/14，其余工具均只覆盖子集
- **速度**：中位耗时 4.4ms，备选工具在 52ms–1130ms 之间，比次快工具还快一个数量级
- **质量**：由 Claude Sonnet 5 盲评完整度、结构、格式与整洁度，AnyDoc 总评 81 分，高于第二名 70 分

需要直说的是，这些数字有明确的边界：语料是 Firecrawl 自有的（未随仓库分发）、质量由 LLM 而非人工评定，且各工具的总分只对其支持的格式取平均——mammoth 的 70 分只覆盖 docx，AnyDoc 的 81 分覆盖全部 14 种。逐格式对比才是公平口径，而 AnyDoc 在每个格式上都领先。

第三方评测也给出类似定位。Wavect 在 8 月 10 日的评测中认为：当办公室文档占主导、且要求本地执行时，AnyDoc 值得做一次基于自有语料的试点；但它没有 OCR，扫描件、手写、视觉版式和字段抽取不是它的主场。评测还提醒，把解析器放进生产管线只是很小的一部分，上传安全（字节检测、大小限制、隔离解析）、分块、权限与检索评估仍是应用层自己的职责。

## 核心总结

- **事实**：Firecrawl 开源 AnyDoc 与 pdf-inspector 两套 Rust 文档解析库，且已内置在 /parse 与 /scrape 接口中
- **能力**：AnyDoc 一个依赖覆盖 14 种格式统一转 Markdown，中位 4.4ms；pdf-inspector 逐页路由文本页与 OCR 页，让 Fire-PDF 快 3.5–5 倍
- **定位**：纯本地、无 API Key、零系统依赖，适合 RAG 与智能体读取 Office 文档的转换层
- **边界**：无 OCR、评测语料私有、质量由 LLM 评定，扫描件与复杂版式仍需托管解析或视觉模型

原文：[Introducing AnyDoc and pdf-inspector: Firecrawl's open-source document parsing stack](https://www.firecrawl.dev/blog/anydoc-and-pdf-inspector)（Firecrawl，2026-08-06）；[Firecrawl AnyDoc Review: 14 Formats to Markdown](https://wavect.io/blog/firecrawl-anydoc-review/)（Wavect，2026-08-10）；[AnyDoc 文档与在线演示](https://firecrawl.github.io/anydoc/)；[firecrawl/anydoc](https://github.com/firecrawl/anydoc)
