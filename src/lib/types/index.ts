// 基本的な型定義

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: Category | null;
  tags: Tag[];
  sources: Source[];
  interestScore: number;
  qualityScore: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
}

export interface CategoryWithCount extends Category {
  articleCount: number;
}
export interface Tag {
  id: string;
  name: string;
}

export interface Source {
  id: string;
  url: string;
  title: string | null;
  type: SourceType;
}

export type SourceType =
  | 'google'
  | 'news'
  | 'reddit'
  | 'github'
  | 'rss'
  | 'tutorial'
  | 'guide'
  | 'analysis'
  | 'article'
  | 'test';

export interface GeneratedArticle {
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  sources: Omit<Source, 'id'>[];
  confidence: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  error?: string;
  pagination?: PaginationParams;
}

export interface CollectionJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  articlesCreated: number;
  metadata?: Record<string, any>;
  createdAt: string;
}
