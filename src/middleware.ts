import { NextRequest, NextResponse } from 'next/server';
import { AuthMiddleware } from './lib/security/auth-middleware';
import { applyRateLimit } from './lib/security/rate-limiter';
import { logger } from './lib/security/logger';
import { env } from './lib/env';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const startTime = Date.now();

  try {
    // CORS設定（本番環境）
    if (env.NODE_ENV === 'production' && env.ALLOWED_ORIGINS?.length) {
      const origin = request.headers.get('origin');
      const referer = request.headers.get('referer');
      
      // 同一オリジンのリクエスト（ブラウザから直接）は許可
      const requestUrl = new URL(request.url);
      const isSameOrigin = !origin || origin === requestUrl.origin;
      const isFromSameHost = referer && new URL(referer).origin === requestUrl.origin;
      
      if (!isSameOrigin && !isFromSameHost && origin && !env.ALLOWED_ORIGINS.includes(origin)) {
        logger.security('CORS_VIOLATION', {
          origin,
          referer,
          requestOrigin: requestUrl.origin,
          pathname,
          allowedOrigins: env.ALLOWED_ORIGINS,
        });
        return NextResponse.json(
          { success: false, error: 'CORS policy violation' },
          { status: 403 }
        );
      }
    }

    // レート制限の適用
    if (env.RATE_LIMIT_ENABLED && pathname.startsWith('/api/')) {
      const rateLimitResponse = applyRateLimit(request);
      if (rateLimitResponse) {
        logger.warn('RATE_LIMIT_EXCEEDED', {
          pathname,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
        });
        return rateLimitResponse;
      }
    }

    // 既存の認証ロジック（プロファイルページ）
    if (pathname.startsWith('/profile')) {
      if (env.NODE_ENV === 'production') {
        const adminHeader = request.headers.get('x-admin-access');
        if (!adminHeader) {
          return NextResponse.redirect(new URL('/articles', request.url));
        }
      }
    }

    // 強化された認証チェック（API）- 全環境で実施（開発環境では警告レベル調整）
    if (pathname.startsWith('/api/')) {
      const authResponse = await AuthMiddleware.authenticate(request);
      if (authResponse) {
        const logLevel = env.NODE_ENV === 'production' ? 'warn' : 'info';
        logger[logLevel]('AUTHENTICATION_FAILED', {
          pathname,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          environment: env.NODE_ENV,
        });
        
        // 開発環境でも認証エラーは返すが、より詳細なエラーメッセージを提供
        if (env.NODE_ENV === 'development') {
          return NextResponse.json({
            success: false,
            error: 'Authentication required',
            hint: 'Set proper JWT token in Authorization header or configure environment variables'
          }, { status: 401 });
        }
        
        return authResponse;
      }
    }

    // セキュリティヘッダーの追加
    const response = NextResponse.next();

    // セキュリティヘッダー
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // CSP ヘッダー（開発環境では緩い設定）
    const cspPolicy =
      env.NODE_ENV === 'production'
        ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.openai.com https://www.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
        : "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';";

    response.headers.set('Content-Security-Policy', cspPolicy);

    // Strict Transport Security (本番環境のみ)
    if (env.NODE_ENV === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    }

    // パフォーマンス測定
    const duration = Date.now() - startTime;
    if (duration > 1000) {
      logger.warn('SLOW_MIDDLEWARE', {
        pathname,
        duration,
      });
    }

    return response;
  } catch (error) {
    logger.error('MIDDLEWARE_ERROR', {
      pathname,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
