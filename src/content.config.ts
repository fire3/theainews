import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const news = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string(),
    // 首页卡片上固定两行的摘要，建议控制在 80 字以内
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string(),
    // 与 src/data/site.ts 中 CATEGORIES 的 slug 对应
    category: z.string(),
    tags: z.array(z.string()).optional().default([]),
    // 文章封面配图（放在 public/covers/ 下），必填；缺少该字段的文章构建会失败，不会发布
    image: z.string(),
    imageAlt: z.string().optional(),
    // 标记为 true 的文章会出现在右侧 Top Stories 中
    topStory: z.boolean().optional().default(false),
  }),
});

export const collections = { news };
