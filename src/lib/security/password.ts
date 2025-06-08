import bcrypt from 'bcryptjs';

/**
 * パスワードのハッシュ化とベリファイのユーティリティ
 */

const SALT_ROUNDS = 12; // セキュリティレベルを高く設定

/**
 * パスワードをハッシュ化
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error('パスワードは8文字以上である必要があります');
  }
  
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * パスワードの検証
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    return false;
  }
  
  return await bcrypt.compare(password, hash);
}

/**
 * パスワードの強度チェック
 */
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('パスワードは8文字以上である必要があります');
  }
  
  if (password.length > 128) {
    errors.push('パスワードは128文字以下である必要があります');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('小文字を含む必要があります');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('大文字を含む必要があります');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('数字を含む必要があります');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('特殊文字を含む必要があります');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}