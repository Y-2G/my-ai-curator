import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

// 認証が必要なAPIパスの定義
const PROTECTED_PATHS = ['/api/admin', '/api/ai', '/api/batch', '/api/users'];

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
   * JWT トークンの検証 (Edge Runtime対応)
   */
  static async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        console.error('JWT_SECRET is not configured');
        return null;
      }

      const secretKey = new TextEncoder().encode(secret);
      const { payload } = await jwtVerify(token, secretKey);

      return {
        userId: payload.userId as string,
        email: payload.email as string,
        role: payload.role as string,
        exp: payload.exp as number,
      };
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * リクエストから認証情報を抽出
   */
  static async extractAuthInfo(request: NextRequest): Promise<JwtPayload | null> {
    // Authorization ヘッダーから取得
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // 内部API認証チェック
      const internalApiKey = process.env.INTERNAL_API_KEY;
      if (internalApiKey && token === internalApiKey) {
        // 内部API用の仮想JWTペイロードを返す
        return {
          userId: 'internal',
          email: 'internal@system',
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 3600, // 1時間有効
        };
      }

      // 通常のJWT検証
      return await this.verifyToken(token);
    }

    // Cookie から取得（フォールバック）
    const cookieToken = request.cookies.get('auth-token')?.value;
    if (cookieToken) {
      return await this.verifyToken(cookieToken);
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
  static async authenticate(request: NextRequest): Promise<NextResponse | null> {
    const pathname = request.nextUrl.pathname;

    // 保護されていないパスはスキップ
    if (!this.isProtectedPath(pathname)) {
      return null;
    }

    // 認証情報を取得
    const authInfo = await this.extractAuthInfo(request);

    if (!authInfo) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 管理者専用パスのチェック
    if (this.isAdminOnlyPath(pathname)) {
      // 管理者かどうかのチェック（emailベースの簡易実装）
      const adminEmail = process.env.ADMIN_USER_ID;
      if (!adminEmail) {
        throw new Error('ADMIN_USER_ID environment variable is required for admin authentication');
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
export async function requireAuth(
  request: NextRequest
): Promise<{ userId: string; email: string } | NextResponse> {
  const authInfo = await AuthMiddleware.extractAuthInfo(request);

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
export async function requireAdmin(
  request: NextRequest
): Promise<{ userId: string; email: string } | NextResponse> {
  const authInfo = await AuthMiddleware.extractAuthInfo(request);

  if (!authInfo) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_USER_ID;
  if (!adminEmail) {
    throw new Error('ADMIN_USER_ID environment variable is required for admin authentication');
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
