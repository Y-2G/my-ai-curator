import { randomBytes, createHash } from 'crypto';
import { NextRequest } from 'next/server';

/**
 * CSRF保護のユーティリティ
 */

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_COOKIE = 'csrf-token';
const TOKEN_LENGTH = 32;

/**
 * CSRFトークンを生成
 */
export function generateCSRFToken(): string {
  return randomBytes(TOKEN_LENGTH).toString('hex');
}

/**
 * CSRFトークンのハッシュを作成
 */
export function hashCSRFToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * 定数時間での文字列比較（タイミング攻撃対策）
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * CSRFトークンを検証
 */
export function verifyCSRFToken(request: NextRequest): boolean {
  // GET, HEAD, OPTIONS メソッドはCSRF攻撃の対象外
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }

  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

  if (!headerToken || !cookieToken) {
    return false;
  }

  // Double Submit Cookie パターン: 同じトークンをヘッダーとクッキーで送信
  // 定数時間比較でタイミング攻撃を防ぐ
  return constantTimeCompare(headerToken, cookieToken);
}

/**
 * API ルートで使用するCSRF保護ミドルウェア
 */
export function requireCSRFToken(request: NextRequest): { valid: boolean; error?: string } {
  const isValid = verifyCSRFToken(request);
  
  if (!isValid && !['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return {
      valid: false,
      error: 'Invalid CSRF token'
    };
  }

  return { valid: true };
}