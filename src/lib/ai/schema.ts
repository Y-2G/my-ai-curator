import { z } from 'zod';

// 記事生成のレスポンススキーマ
export const GeneratedArticleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// 興味度スコアのレスポンススキーマ
export const InterestScoreSchema = z.object({
  score: z.number().min(0).max(10),
  reasoning: z.string(),
});

// カテゴリ分類のレスポンススキーマ
export const CategoryClassificationSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
});
