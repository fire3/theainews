# The AI News — 智能体工作指引

基于 Astro 的 AI 新闻内容站（https://theainews.cc），仓库已接入 Vercel，推送到 Git 后自动构建并发布。

## 添加/发布文章

在 `src/content/news/` 下新建一个 Markdown 文件，文件名即文章 URL 的 slug，建议格式 `yyyy-mm-dd-english-slug.md`（避免中文与空格）。

文件头部必须包含以下 frontmatter（字段定义见 `src/content.config.ts`）：

```yaml
---
title: "文章标题"
description: "首页卡片上固定两行的摘要，建议 80 字以内"
pubDate: 2026-08-01
author: "作者名"
category: "industry"          # 必须是 src/data/site.ts 中 CATEGORIES 的 slug：
                              # models / tools / research / industry / tutorial
tags: ["标签一", "标签二"]
image: "/covers/example.jpg"  # 可选，封面图；放在 public/ 下，路径以 / 开头。
                              # 缺省时自动展示对应栏目默认封面（public/covers/default-*.png）
imageAlt: "配图描述"           # 可选，建议填写
topStory: true                # 可选，true 时进入首页右侧 Top Stories
---
```

## 发布要求

- `category` 必须与 `src/data/site.ts` 中的 `CATEGORIES` slug 一致，否则构建会报错
- 图片统一放在 `public/` 下：`public/covers/` 放封面，`public/images/` 放正文配图
- 正文中插入本地图片时路径以 `/` 开头，构建时会自动复制到站点根目录，例如 `![配图描述](/images/example.jpg)`
- `image` 为可选字段：不设置时自动展示对应栏目默认封面（`public/covers/default-<栏目>.png`）
- 新增/修改文章后必须运行 `pnpm build` 验证构建通过
- 验证通过后可直接 commit + push（注意解决冲突），Vercel 会自动部署

### 粗体检查（写完全文必须自查）

中文 Markdown 里有一个会让粗体渲染失败的坑：当闭合 `**` **前**紧跟标点、**后**紧跟非标点字符（如中文）时，渲染器会把该 `**` 判为左包围（left-flanking）、当作开标签，导致粗体不闭合、原样输出 `**`。

- 失败例：`**两个工具调用。**搜索`（显示为字面 `**`）
- 正常例：`**前后是中文**直接连中文`、`**工作负载（Workload）**：……`（后跟标点/空格时正常）
- **推荐写法**：需要「粗体紧贴中文无空格」时，用 HTML 标签 `<strong>…</strong>` 替代 `**`。

**提交前必须运行：**
```bash
node scripts/check-markdown-bold.mjs        # 扫描全部文章，发现问题返回退出码 1
node scripts/check-markdown-bold.mjs 文件…   # 或指定文件
```
扫描无输出、退出码 0 才算通过。脚本也可自动给出 `<strong>` 建议。

## 写作规范

面向 AI 从业者的中文科技内容，风格客观、简洁、有信息量。参考 `src/content/news/` 下现有文章。

- **语言**：全中文撰写；术语首次出现时可用英文对照（如「准备框架（Preparedness Framework）」）；全文使用 Markdown
- **标题**：中文描述式标题，通常为「主体：事件/解读」结构，概括核心信息，不夸大、不故弄玄虚
- **摘要（description）**：80 字以内，直接给出核心事实（谁、做了什么、为什么重要），不要写成疑问句或悬念式
- **新闻类结构**：导语一段交代 5W → 用 `##` 分节展开背景、细节与影响 → 「核心总结」小节用列表收束 → 文末附原文链接
- **教程类结构**：开头说明解决什么问题 → 分步骤/分方式展开（可用表格、代码块）→ 「核心总结」→ 文末附参考链接
- **来源与事实**：忠于信源，不编造数据与引语；关键数字、事实和引述必须能在文末链接中溯源；引用他人原话用引号并注明出处
- **排版**：关键结论与核心术语用 `**加粗**`（若粗体后面紧跟中文无空格，须改为 `<strong>…</strong>`，见上方「粗体检查」）；条目、对比、步骤用列表或表格；代码用代码块并标注语言；正文配图可选
- **篇幅**：新闻类 300–500 字左右（重大选题可更长）；教程类按内容需要，通常 800 字以上
- **结尾引用格式**：新闻用 `原文：[标题](链接)（来源媒体，日期）`，教程用 `参考：` 列表
- **价值观**：技术名词与结论准确，避免主观断言与营销化用语，保持「可信赖 AI 新闻平台」的口径

## 本地开发

```bash
pnpm install
pnpm dev        # 开发预览 http://localhost:4321
pnpm build      # 构建静态站点到 dist/
pnpm preview    # 本地预览构建产物
```

## 相关文件

- `src/content/news/`：文章目录，新增文章放这里
- `src/content.config.ts`：frontmatter schema
- `src/data/site.ts`：站点配置与栏目（CATEGORIES）
- `public/`：静态资源（covers/、images/）
