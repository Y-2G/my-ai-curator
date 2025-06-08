import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

// 認証が必要なAPIパスの定義
const PROTECTED_PATHS = ['/api/admin', '/api/articles/generate', '/api/ai'];

// 管理者専用APIパスの定義
const ADMIN_ONLY_PATHS = ['/api/admin', '/api/debug', '/api/users'];

interface JwtPayload {
  userId: string;
  email: string;
  role?: string;
  exp?: number;
}

export class AuthMiddleware {
  /**
   * JWT トークンの検証
   */
  static verifyToken(token: string): JwtPayload | null {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('JWT_SECRET is not configured');
        return null;
      }

      const decoded = jwt.verify(token, secret) as JwtPayload;

      // 有効期限チェック
      if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
        console.warn('Token has expired');
        return null;
      }

      return decoded;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * リクエストから認証情報を抽出
   */
  static extractAuthInfo(request: NextRequest): JwtPayload | null {
    // Authorization ヘッダーから取得
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return this.verifyToken(token);
    }

    // Cookie から取得（フォールバック）
    const cookieToken = request.cookies.get('auth-token')?.value;
    if (cookieToken) {
      return this.verifyToken(cookieToken);
    }

    return null;
  }

  /**
   * パスが保護されているかチェック
   */
  static isProtectedPath(pathname: string): boolean {
    return PROTECTED_PATHS.some((path) => pathname.startsWith(path));
  }

  /**
   * パスが管理者専用かチェック
   */
  static isAdminOnlyPath(pathname: string): boolean {
    return ADMIN_ONLY_PATHS.some((path) => pathname.startsWith(path));
  }

  /**
   * 認証ミドルウェア
   */
  static authenticate(request: NextRequest): NextResponse | null {
    const pathname = request.nextUrl.pathname;

    // 保護されていないパスはスキップ
    if (!this.isProtectedPath(pathname)) {
      return null;
    }

    // 認証情報を取得
    const authInfo = this.extractAuthInfo(request);

    if (!authInfo) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 管理者専用パスのチェック
    if (this.isAdminOnlyPath(pathname)) {
      // 管理者かどうかのチェック（emailベースの簡易実装）
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        throw new Error('ADMIN_EMAIL environment variable is required for admin authentication');
      }
      const isAdmin = authInfo.email === adminEmail || authInfo.role === 'admin';

      if (!isAdmin) {
        return NextResponse.json(
          { success: false, error: 'Admin access required' },
          { status: 403 }
        );
      }
    }

    // リクエストヘッダーにユーザー情報を追加
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', authInfo.userId);
    requestHeaders.set('x-user-email', authInfo.email);

    return null; // 認証成功
  }
}

/**
 * API ルートで使用するための認証ヘルパー
 */
export function requireAuth(
  request: NextRequest
): { userId: string; email: string } | NextResponse {
  const authInfo = AuthMiddleware.extractAuthInfo(request);

  if (!authInfo) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  return {
    userId: authInfo.userId,
    email: authInfo.email,
  };
}

/**
 * 管理者権限が必要なAPI用のヘルパー
 */
export function requireAdmin(
  request: NextRequest
): { userId: string; email: string } | NextResponse {
  const authInfo = AuthMiddleware.extractAuthInfo(request);

  if (!authInfo) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error('ADMIN_EMAIL environment variable is required for admin authentication');
  }
  const isAdmin = authInfo.email === adminEmail || authInfo.role === 'admin';

  if (!isAdmin) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  return {
    userId: authInfo.userId,
    email: authInfo.email,
  };
}
