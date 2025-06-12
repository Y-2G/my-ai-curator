import { z } from 'zod';
import {
  GeneratedArticleSchema,
  InterestScoreSchema,
  CategoryClassificationSchema,
} from './schema';

// AI関連の型定義

export interface UserInterestProfile {
  id: string;
  name: string;
  email: string;
  profile?: {
    preferredStyle?: 'technical' | 'casual' | 'balanced';
    bio?: string;
    location?: string;
  };
  interests?: {
    categories?: string[];
    tags?: string[];
    keywords?: string[];
  };
  userInterests?: Array<{
    keyword: string;
    weight: number;
    lastUsed: string;
  }>;
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
