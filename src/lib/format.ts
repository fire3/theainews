import { CATEGORIES } from '../data/site';

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}

// 各栏目默认封面：文章未设置 image 时按栏目展示对应配图
const CATEGORY_COVER: Record<string, string> = {
  models: '/covers/default-models.png',
  tools: '/covers/default-tools.png',
  research: '/covers/default-research.png',
  industry: '/covers/default-industry.png',
  tutorial: '/covers/default-tutorial.png',
};

export function categoryCover(slug: string): string {
  return CATEGORY_COVER[slug] ?? '/covers/placeholder.svg';
}
