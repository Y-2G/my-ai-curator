import { z } from 'zod';
import {
  GeneratedArticleSchema,
  InterestScoreSchema,
  CategoryClassificationSchema,
} from './schema';

// AI関連の型定義

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  profile?: {
    preferredStyle?: 'technical' | 'casual' | 'balanced';
    bio?: string;
  };
  interests?: {
    categories?: string[];
    tags?: string[];
    keywords?: string[];
  };
  userInterests?: Array<{
    id: string;
    keyword: string;
    weight: number;
    lastUsed: string;
  }>;
  stats?: {
    articlesCount?: number;
    interestsCount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface SearchQuery {
  query: string;
  category: string;
  priority: number;
  reasoning: string;
  sources: string[];
}

export type GeneratedArticle = z.infer<typeof GeneratedArticleSchema>;
export type InterestScore = z.infer<typeof InterestScoreSchema>;
export type CategoryClassification = z.infer<typeof CategoryClassificationSchema>;

// プロンプト管理用の型
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'search' | 'evaluation' | 'generation' | 'classification';
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawContentData {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date;
  source: string;
  type: string;
}
