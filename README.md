# The AI News — Astro 内容站模板

基于 [Astro](https://astro.build/) 的 AI 新闻内容站模板，首页视觉风格参考 [thehackernews.com](https://thehackernews.com/)：

- 顶部标语栏 + 站点标识 + 白色栏目导航
- 左侧固定卡片文章列表：左侧固定尺寸配图，右侧标题、日期与固定两行摘要
- 右侧 “⚡ Top Stories This Week” 侧栏（可展开更多）
- 文章详情页、分类页
- 简洁页脚，无任何社交元素

## 快速开始

```bash
pnpm install
pnpm dev        # 开发预览 http://localhost:4321
pnpm build      # 构建静态站点到 dist/
pnpm preview    # 本地预览构建产物
```

## 目录结构

```text
src/
├── content/
│   └── news/              # 文章（Markdown），文件名即文章 slug
├── content.config.ts      # 内容集合定义（schema 与 loader）
├── components/
│   ├── Header.astro       # 顶部标语栏、Logo、栏目导航
│   ├── ArticleCard.astro  # 首页文章卡片
│   ├── TopStories.astro   # 右侧 Top Stories
│   └── Footer.astro       # 页脚
├── layouts/
│   └── BaseLayout.astro
├── pages/
│   ├── index.astro                # 首页
│   ├── articles/[slug].astro      # 文章详情
│   └── categories/[category].astro # 分类页
├── data/site.ts           # 站点名称、标语、栏目配置
├── lib/format.ts          # 日期格式化等工具
└── styles/global.css      # 全部样式（THN 风格）
```

> 注意：Astro 5+ 的内容集合定义文件位于 `src/content.config.ts`（不是 `src/content/config.ts`）。

## 添加一篇文章

在 `src/content/news/` 下新建一个 `.md` 文件，文件名即文章 URL 的 slug，frontmatter 字段如下：

```yaml
---
title: "文章标题"
description: "首页卡片上固定两行的摘要，建议 80 字以内"
pubDate: 2026-07-31
author: "作者名"
category: "models"          # 与 src/data/site.ts 中 CATEGORIES 的 slug 对应
tags: ["标签一", "标签二"]
image: "/covers/model-1.svg"  # 配图，放在 public/ 下任意位置
imageAlt: "配图描述"
topStory: true              # true 时进入首页右侧 Top Stories
---

正文 Markdown 从这里开始……
```

## 定制站点

- **站点名称 / 标语 / 描述**：修改 `src/data/site.ts` 中的 `SITE`
- **栏目**：修改 `src/data/site.ts` 中的 `CATEGORIES`（顶部导航与分类页会同步生成）
- **主题色**：修改 `src/styles/global.css` 顶部的 `:root` 变量（主色 `--brand-primary` 等）
- **卡片尺寸**：修改 `--card-height`（桌面 140px，移动端 118px）

## 部署

构建产物为纯静态文件（`dist/`），可部署到 Vercel、Netlify、Cloudflare Pages 或任意静态服务器。部署前记得把 `astro.config.mjs` 中的 `site` 改成你的正式域名。
