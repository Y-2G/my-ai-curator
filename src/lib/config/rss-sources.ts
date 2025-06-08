// 実際のRSSソース設定
export interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string;
  description: string;
  active: boolean;
  priority: number; // 1-10 (高いほど優先)
}

export const RSS_SOURCES: RSSSource[] = [
  // 技術系
  {
    id: 'dev-to',
    name: 'DEV Community',
    url: 'https://dev.to/feed',
    category: 'tech',
    description: '開発者コミュニティの最新記事',
    active: true,
    priority: 8,
  },
  {
    id: 'hashnode',
    name: 'Hashnode',
    url: 'https://hashnode.com/feed',
    category: 'tech',
    description: '技術ブログプラットフォーム',
    active: true,
    priority: 7,
  },
  {
    id: 'medium-tech',
    name: 'Medium Technology',
    url: 'https://medium.com/feed/tag/technology',
    category: 'tech',
    description: 'Medium の技術記事',
    active: true,
    priority: 6,
  },

  // React/Next.js 特化
  {
    id: 'react-blog',
    name: 'React Blog',
    url: 'https://react.dev/blog/rss.xml',
    category: 'react',
    description: 'React 公式ブログ',
    active: true,
    priority: 10,
  },
  {
    id: 'nextjs-blog',
    name: 'Next.js Blog',
    url: 'https://nextjs.org/feed.xml',
    category: 'nextjs',
    description: 'Next.js 公式ブログ',
    active: true,
    priority: 10,
  },

  // TypeScript
  {
    id: 'typescript-blog',
    name: 'TypeScript Blog',
    url: 'https://devblogs.microsoft.com/typescript/feed/',
    category: 'typescript',
    description: 'TypeScript 公式ブログ',
    active: true,
    priority: 9,
  },

  // 一般技術ニュース
  {
    id: 'hacker-news-rss',
    name: 'Hacker News',
    url: 'https://hnrss.org/frontpage',
    category: 'news',
    description: 'Hacker News フロントページ',
    active: true,
    priority: 8,
  },
  {
    id: 'techcrunch',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'news',
    description: 'テックニュース',
    active: true,
    priority: 6,
  },

  // 日本語技術情報
  {
    id: 'qiita',
    name: 'Qiita',
    url: 'https://qiita.com/popular-items/feed',
    category: 'tech-ja',
    description: 'Qiita 人気記事',
    active: true,
    priority: 8,
  },
  {
    id: 'zenn',
    name: 'Zenn',
    url: 'https://zenn.dev/feed',
    category: 'tech-ja',
    description: 'Zenn 最新記事',
    active: true,
    priority: 8,
  },
];

export const RSS_CATEGORIES = [
  'tech',
  'react',
  'nextjs', 
  'typescript',
  'news',
  'tech-ja',
] as const;

export type RSSCategory = typeof RSS_CATEGORIES[number];

export function getActiveRSSSources(): RSSSource[] {
  return RSS_SOURCES.filter(source => source.active).sort((a, b) => b.priority - a.priority);
}

export function getRSSSourcesByCategory(category: RSSCategory): RSSSource[] {
  return RSS_SOURCES.filter(source => source.active && source.category === category);
}