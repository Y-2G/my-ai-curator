import { z } from 'zod';
import { PAGINATION } from '@/lib/constants';

// 共通のクエリパラメータスキーマ
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).optional().default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().min(1).max(PAGINATION.MAX_LIMIT).optional().default(PAGINATION.DEFAULT_LIMIT),
});

// 記事一覧用のクエリスキーマ
export const articleListQuerySchema = paginationSchema.extend({
  category: z.string().uuid().optional(),
  tag: z.string().uuid().optional(),
  sort: z.enum(['createdAt', 'interestScore', 'qualityScore']).optional().default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
});

// UUID パラメータのバリデーション
export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

// クエリパラメータの安全な解析
export function parseSearchParams<T extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: T
): z.infer<T> | null {
  try {
    const params = Object.fromEntries(searchParams);
    return schema.parse(params);
  } catch {
    return null;
  }
}