import { z } from 'zod';

/**
 * セキュアな入力値検証スキーマ
 */

// 基本的なセキュリティパターン
const _SAFE_STRING_PATTERN = /^[a-zA-Z0-9\s\-_.()!?、。「」『』【】〈〉〔〕]*$/;
const _EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// HTMLタグを除去するサニタイザー
export function sanitizeHtml(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // script タグを除去
    .replace(/<[^>]*>/g, '') // 全HTMLタグを除去
    .replace(/javascript:/gi, '') // javascript: プロトコルを除去
    .replace(/on\w+\s*=/gi, '') // イベントハンドラーを除去
    .trim();
}

// SQLインジェクション対策のサニタイザー
export function sanitizeSql(input: string): string {
  return input
    .replace(/['"\\]/g, '') // クォートとバックスラッシュを除去
    .replace(/;\s*(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE)\s+/gi, '') // 危険なSQL文を除去
    .replace(/UNION\s+SELECT/gi, '') // UNION SELECT を除去
    .trim();
}

// 改行コードとタブを正規化
export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, '\n') // CRLF を LF に統一
    .replace(/\r/g, '\n') // CR を LF に統一
    .replace(/\t/g, '  ') // タブをスペースに変換
    .replace(/\s+$/gm, '') // 行末の空白を除去
    .trim();
}

/**
 * セキュアな検証スキーマ
 */

// ユーザー入力用のセキュアな文字列
const secureString = (minLength: number = 1, maxLength: number = 255) =>
  z.string()
    .min(minLength, `最低${minLength}文字必要です`)
    .max(maxLength, `最大${maxLength}文字までです`)
    .transform(sanitizeHtml)
    .refine((val) => val.length >= minLength, {
      message: `サニタイズ後も最低${minLength}文字必要です`,
    });

// コンテンツ用の文字列（マークダウン許可）
const contentString = (maxLength: number = 10000) =>
  z.string()
    .max(maxLength, `最大${maxLength}文字までです`)
    .transform((val) => {
      // マークダウンは許可するが、危険なHTMLは除去
      return val
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    });

// UUID検証
const uuidSchema = z.string().regex(UUID_PATTERN, 'Invalid UUID format');

// メール検証
const emailSchema = z.string()
  .email('無効なメールアドレスです')
  .max(254, 'メールアドレスが長すぎます')
  .transform((val) => val.toLowerCase().trim());

// 記事作成・更新の検証スキーマ
export const ArticleValidationSchema = z.object({
  title: secureString(1, 200),
  summary: secureString(1, 500),
  content: contentString(50000),
  category: secureString(1, 100).optional(),
  tags: z.array(secureString(1, 50)).max(20, '最大20個のタグまでです').default([]),
  sources: z.array(z.object({
    url: z.string().url('無効なURLです').max(2000),
    title: secureString(1, 200).optional(),
    type: secureString(1, 50).optional(),
  })).max(50, '最大50個のソースまでです').default([]),
  qualityScore: z.number().min(0).max(10).default(0),
  interestScore: z.number().min(0).max(10).default(0),
  publishedAt: z.string().datetime().optional(),
});

// ユーザープロファイル更新の検証スキーマ
export const UserProfileValidationSchema = z.object({
  name: secureString(1, 100),
  profile: z.object({
    techLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    preferredStyle: z.enum(['technical', 'casual', 'balanced']).optional(),
    bio: secureString(0, 1000).optional(),
  }).optional(),
  interests: z.object({
    categories: z.array(secureString(1, 100)).max(50).optional(),
    tags: z.array(secureString(1, 100)).max(100).optional(),
    keywords: z.array(secureString(1, 100)).max(200).optional(),
  }).optional(),
});

// ログイン検証スキーマ
export const LoginValidationSchema = z.object({
  email: emailSchema,
  password: z.string()
    .min(8, 'パスワードは8文字以上必要です')
    .max(128, 'パスワードが長すぎます')
    // 危険な文字を除去
    .transform((val) => val.replace(/[<>'"&]/g, '')),
});

// API クエリパラメータの検証
export const ApiQueryValidationSchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 1000).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100).optional(),
  category: uuidSchema.or(secureString(1, 100)).optional(),
  tag: secureString(1, 100).optional(),
  search: secureString(0, 200).optional(),
  sort: z.enum(['createdAt', 'interestScore', 'qualityScore']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

/**
 * リクエストサニタイゼーション関数
 */
export function sanitizeRequest(req: unknown): unknown {
  if (typeof req === 'string') {
    return sanitizeHtml(req);
  }
  
  if (Array.isArray(req)) {
    return req.map(sanitizeRequest);
  }
  
  if (req && typeof req === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req)) {
      // 危険なキーを除外
      if (['__proto__', 'constructor', 'prototype'].includes(key)) {
        continue;
      }
      sanitized[key] = sanitizeRequest(value);
    }
    return sanitized;
  }
  
  return req;
}

/**
 * レート制限用のキー生成
 */
export function generateRateLimitKey(request: Request, identifier: string): string {
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const hash = Buffer.from(`${identifier}:${userAgent}`).toString('base64');
  return `rate_limit:${hash}`;
}