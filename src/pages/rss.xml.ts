import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { SITE } from '../data/site';
import { getAllPosts } from '../lib/posts';

export async function GET(context: APIContext) {
  const posts = await getAllPosts();
  return rss({
    title: SITE.title,
    description: SITE.description,
    site: context.site ?? 'https://theainews.cc',
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.pubDate,
      link: `/articles/${post.id}/`,
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: '<language>zh-CN</language>',
  });
}
