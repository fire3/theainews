// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// https://astro.build/config
export default defineConfig({
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [rehypeKatex],
    }),
  },
  // 站点地址（用于 SEO / 生成绝对链接 / sitemap）
  site: 'https://theainews.cc',
  integrations: [
    // 构建时生成 sitemap-index.xml 与 sitemap-0.xml
    sitemap(),
  ],
});
