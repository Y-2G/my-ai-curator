/**
 * 本番環境で安全なログ出力を行うユーティリティ
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  [key: string]: unknown;
}

/**
 * 本番環境で機密情報を含む可能性のあるデータをサニタイズ
 */
function sanitizeForProduction(data: unknown): unknown {
  if (process.env.NODE_ENV !== 'production') {
    return data; // 開発環境では元のデータをそのまま返す
  }

  if (typeof data === 'string') {
    // パスワード、トークン、キーなどの機密情報をマスク
    return data
      .replace(/password[^"]*"[^"]*"/gi, 'password":"***"')
      .replace(/token[^"]*"[^"]*"/gi, 'token":"***"')
      .replace(/secret[^"]*"[^"]*"/gi, 'secret":"***"')
      .replace(/key[^"]*"[^"]*"/gi, 'key":"***"')
      .replace(/authorization[^"]*"[^"]*"/gi, 'authorization":"***"');
  }

  if (data && typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('password') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('key')) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitizeForProduction(value);
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * 安全なロガー
 */
export class SafeLogger {
  static log(level: LogLevel, message: string, context?: LogContext): void {
    const timestamp = new Date().toISOString();
    const sanitizedContext = context ? sanitizeForProduction(context) : undefined;
    
    const logData = {
      timestamp,
      level,
      message,
      ...(sanitizedContext && { context: sanitizedContext }),
    };

    switch (level) {
      case 'error':
        console.error(JSON.stringify(logData));
        break;
      case 'warn':
        console.warn(JSON.stringify(logData));
        break;
      case 'debug':
        if (process.env.NODE_ENV === 'development') {
          console.debug(JSON.stringify(logData));
        }
        break;
      default:
        console.log(JSON.stringify(logData));
    }
  }

  static info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  static warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  static error(message: string, context?: LogContext): void {
    this.log('error', message, context);
  }

  static debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }
}

/**
 * エラーレスポンス用のサニタイザー
 */
export function sanitizeErrorResponse(error: unknown): {
  message: string;
  code?: string;
} {
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    return {
      message: error.message,
      code: error.name,
    };
  }

  // 本番環境では一般的なエラーメッセージのみ
  return {
    message: 'Internal server error',
  };
}