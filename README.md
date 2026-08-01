# The AI News

基于 [Astro](https://astro.build/) 的 AI 新闻内容站，线上地址：**https://theainews.cc**。

仓库已接入 Vercel：代码推送到 Git 后自动构建并发布，无需手动部署。

## 添加文章

在 `src/content/news/` 下新建一个 Markdown 文件，文件名即文章 URL 的 slug（建议 `yyyy-mm-dd-english-slug.md` 格式，避免中文与空格），然后在文件头部写 frontmatter：

```yaml
---
title: "文章标题"
description: "首页卡片上固定两行的摘要，建议 80 字以内"
pubDate: 2026-08-01
author: "作者名"
category: "industry"          # 必须是 src/data/site.ts 中 CATEGORIES 的 slug：
                              # models / tools / research / industry / policy
tags: ["标签一", "标签二"]
image: "/covers/example.jpg"  # 必填，文章封面图；放在 public/ 下，路径以 / 开头。
                              # 缺少封面配图的文章无法通过构建，不会被发布
imageAlt: "配图描述"           # 可选，建议填写
topStory: true                # 可选，true 时进入首页右侧 Top Stories
---

正文 Markdown 从这里开始……
```

几点提醒：

- 正文中也可以插入本地图片，路径以 `/` 开头即可，构建时会自动复制到站点根目录：

  ```markdown
  ![配图描述](/images/example.jpg)
  ```

- 图片统一放在 `public/` 下（如 `public/covers/` 作为封面、`public/images/` 作为正文配图）
- `image` 为必填字段：文章必须设置封面配图，否则构建失败、无法发布
- `category` 必须与 `src/data/site.ts` 中的 `CATEGORIES` slug 一致，否则构建会报错
- 保存并推送到 Git 后 Vercel 会自动部署；正式发布前可用下面的命令本地验证

## 本地开发

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
│   └── news/              # 文章目录：新增文章放这里
├── content.config.ts      # 内容集合定义（frontmatter 字段的 schema）
├── components/            # Header、ArticleCard、TopStories、Footer 等组件
├── layouts/               # BaseLayout.astro 全局布局
├── pages/                 # 首页、文章详情页、分类页
├── data/site.ts           # 站点名称、标语、栏目配置
├── lib/format.ts          # 日期格式化等工具
└── styles/global.css      # 全部样式
public/                    # 静态资源：配图放在这里（covers/、images/）
```

## 定制站点

- 站点名称 / 标语 / 描述：`src/data/site.ts` 中的 `SITE`
- 栏目：`src/data/site.ts` 中的 `CATEGORIES`（顶部导航与分类页会同步生成）
- 主题色：`src/styles/global.css` 顶部的 `:root` 变量（主色 `--brand-primary` 等）
- 品牌字体：`--font-display`（默认 Space Grotesk，`@fontsource-variable` 自托管）

## 部署

本仓库已接入 Vercel 自动部署，推送到 Git 后自动构建并发布到 https://theainews.cc。如需调整域名或预览分支，在 Vercel 项目设置中修改即可。
