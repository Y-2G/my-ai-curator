import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // 時間窓（ミリ秒）
  maxRequests: number; // 最大リクエスト数
  message?: string; // エラーメッセージ
  skipSuccessfulRequests?: boolean; // 成功したリクエストをスキップするか
  skipFailedRequests?: boolean; // 失敗したリクエストをスキップするか
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  createdAt: number;
}

// インメモリストレージ（本番環境ではRedisを推奨）
const storage = new Map<string, RateLimitEntry>();

// 定期的にクリーンアップ（メモリリーク防止）
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of storage.entries()) {
    if (now > entry.resetTime) {
      storage.delete(key);
    }
  }
}, 60000); // 1分ごとにクリーンアップ

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests, please try again later.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };
  }

  /**
   * リクエストの識別子を生成
   */
  private generateKey(request: NextRequest): string {
    // IPアドレスベース（プロキシ経由の場合はX-Forwarded-Forを確認）
    const ip =
      request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

    // パスとIPを組み合わせてキーを生成
    const path = request.nextUrl.pathname;
    return `rate_limit:${path}:${ip}`;
  }

  /**
   * レート制限をチェック
   */
  check(request: NextRequest): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.generateKey(request);
    const now = Date.now();
    const resetTime = now + this.config.windowMs;

    let entry = storage.get(key);

    // エントリが存在しないか、期限切れの場合は新規作成
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 1,
        resetTime,
        createdAt: now,
      };
      storage.set(key, entry);
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime,
      };
    }

    // リクエスト数をインクリメント
    entry.count++;

    // 制限チェック
    const allowed = entry.count <= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - entry.count);

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  /**
   * レート制限を適用
   */
  apply(request: NextRequest): NextResponse | null {
    const result = this.check(request);

    if (!result.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: this.config.message,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': this.config.maxRequests.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
            'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    return null; // レート制限内
  }
}

// 事前定義されたレート制限設定
export const rateLimiters = {
  // 一般的なAPI（1分間に60リクエスト）
  general: new RateLimiter({
    windowMs: 60 * 1000, // 1分
    maxRequests: 60,
    message: 'Too many requests. Please try again in a minute.',
  }),

  // 認証API（5分間に10リクエスト）
  auth: new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5分
    maxRequests: 10,
    message: 'Too many authentication attempts. Please try again in 5 minutes.',
  }),

  // AI生成API（1時間に20リクエスト）
  aiGeneration: new RateLimiter({
    windowMs: 60 * 60 * 1000, // 1時間
    maxRequests: 20,
    message: 'Too many AI generation requests. Please try again in an hour.',
  }),

  // 管理者API（1分間に30リクエスト）
  admin: new RateLimiter({
    windowMs: 60 * 1000, // 1分
    maxRequests: 30,
    message: 'Too many admin requests. Please try again later.',
  }),

  // 記事検索API（1分間に100リクエスト）
  search: new RateLimiter({
    windowMs: 60 * 1000, // 1分
    maxRequests: 100,
    message: 'Too many search requests. Please try again later.',
  }),
};

/**
 * パスベースでレート制限を適用するヘルパー
 */
export function applyRateLimit(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;

  // 認証API
  if (pathname.startsWith('/api/auth/')) {
    return rateLimiters.auth.apply(request);
  }

  // AI生成API
  if (pathname.startsWith('/api/ai/') || pathname.includes('/generate')) {
    return rateLimiters.aiGeneration.apply(request);
  }

  // 管理者API
  if (pathname.startsWith('/api/admin/') || pathname.startsWith('/api/debug/')) {
    return rateLimiters.admin.apply(request);
  }

  // 記事検索API
  if (
    pathname.startsWith('/api/articles/') ||
    pathname.startsWith('/api/categories/') ||
    pathname.startsWith('/api/tags/')
  ) {
    return rateLimiters.search.apply(request);
  }

  // その他のAPI
  if (pathname.startsWith('/api/')) {
    return rateLimiters.general.apply(request);
  }

  return null; // レート制限なし
}

/**
 * レート制限の統計情報を取得（管理用）
 */
export function getRateLimitStats(): { key: string; count: number; resetTime: number }[] {
  const stats: { key: string; count: number; resetTime: number }[] = [];
  const now = Date.now();

  for (const [key, entry] of storage.entries()) {
    if (now <= entry.resetTime) {
      stats.push({
        key,
        count: entry.count,
        resetTime: entry.resetTime,
      });
    }
  }

  return stats.sort((a, b) => b.count - a.count);
}
