import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';

// 首页每页展示的文章数量
export const POSTS_PER_PAGE = 8;

export interface PageInfo {
  currentPage: number;
  totalPages: number;
  items: CollectionEntry<'news'>[];
  hasPrev: boolean;
  hasNext: boolean;
}

export async function getAllPosts(): Promise<CollectionEntry<'news'>[]> {
  return (await getCollection('news')).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
}

export function paginate(posts: CollectionEntry<'news'>[], page: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * POSTS_PER_PAGE;
  return {
    currentPage,
    totalPages,
    items: posts.slice(start, start + POSTS_PER_PAGE),
    hasPrev: currentPage > 1,
    hasNext: currentPage < totalPages,
  };
}

export function pagePath(page: number): string {
  return page === 1 ? '/' : `/page/${page}/`;
}
