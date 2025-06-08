/**
 * セキュアなログ出力システム
 */

// 機密情報のパターン
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /auth/i,
  /credential/i,
  /api[_-]?key/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /bearer/i,
  /authorization/i,
];

// 機密データをマスクするパターン
const MASK_PATTERNS = [
  // Email addresses
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '***@***.***',
  },
  // JWTトークン
  {
    pattern: /eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_.+/]*/g,
    replacement: 'jwt_***',
  },
  // UUIDs
  {
    pattern: /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    replacement: 'uuid_***',
  },
  // API Keys (32-64文字の英数字)
  {
    pattern: /\b[A-Za-z0-9]{32,64}\b/g,
    replacement: 'api_key_***',
  },
  // クレジットカード番号
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '****-****-****-****',
  },
  // 電話番号
  {
    pattern: /\b\d{3}-\d{4}-\d{4}\b/g,
    replacement: '***-****-****',
  },
];

/**
 * ログレベル
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * ログエントリの構造
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  requestId?: string;
  ip?: string;
}

/**
 * セキュアロガークラス
 */
export class SecureLogger {
  private static instance: SecureLogger;
  private isDevelopment: boolean;

  private constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
  }

  static getInstance(): SecureLogger {
    if (!SecureLogger.instance) {
      SecureLogger.instance = new SecureLogger();
    }
    return SecureLogger.instance;
  }

  /**
   * 機密情報をサニタイズ
   */
  private sanitize(data: any): any {
    if (typeof data === 'string') {
      let sanitized = data;
      
      // 機密情報のパターンをマスク
      for (const maskPattern of MASK_PATTERNS) {
        sanitized = sanitized.replace(maskPattern.pattern, maskPattern.replacement);
      }
      
      return sanitized;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: Record<string, any> = {};
      
      for (const [key, value] of Object.entries(data)) {
        // 機密情報と思われるキーをチェック
        const isSensitive = SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
        
        if (isSensitive) {
          sanitized[key] = '***';
        } else {
          sanitized[key] = this.sanitize(value);
        }
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * ログエントリを作成
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    metadata?: Record<string, any>
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message: this.sanitize(message),
      metadata: metadata ? this.sanitize(metadata) : undefined,
    };
  }

  /**
   * ログを出力
   */
  private output(entry: LogEntry): void {
    const logMessage = {
      ...entry,
      env: process.env.NODE_ENV,
    };

    // 開発環境では詳細出力
    if (this.isDevelopment) {
      console.warn(JSON.stringify(logMessage, null, 2));
    } else {
      // 本番環境では構造化ログ
      console.warn(JSON.stringify(logMessage));
    }
  }

  /**
   * エラーログ
   */
  error(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, metadata);
    this.output(entry);
  }

  /**
   * 警告ログ
   */
  warn(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, metadata);
    this.output(entry);
  }

  /**
   * 情報ログ
   */
  info(message: string, metadata?: Record<string, any>): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, metadata);
    this.output(entry);
  }

  /**
   * デバッグログ（開発環境のみ）
   */
  debug(message: string, metadata?: Record<string, any>): void {
    if (this.isDevelopment) {
      const entry = this.createLogEntry(LogLevel.DEBUG, message, metadata);
      this.output(entry);
    }
  }

  /**
   * セキュリティイベントのログ
   */
  security(event: string, details: Record<string, any>): void {
    this.error(`SECURITY_EVENT: ${event}`, {
      ...details,
      severity: 'high',
      category: 'security',
    });
  }

  /**
   * APIアクセスログ
   */
  apiAccess(
    method: string,
    path: string,
    statusCode: number,
    duration: number,
    userId?: string,
    ip?: string
  ): void {
    this.info('API_ACCESS', {
      method,
      path: this.sanitize(path),
      statusCode,
      duration,
      userId,
      ip: this.sanitize(ip || ''),
    });
  }

  /**
   * 認証イベントのログ
   */
  authEvent(event: 'login' | 'logout' | 'failed_login', userId?: string, ip?: string): void {
    this.info(`AUTH_${event.toUpperCase()}`, {
      userId,
      ip: this.sanitize(ip || ''),
      timestamp: new Date().toISOString(),
    });
  }
}

// シングルトンインスタンス
export const logger = SecureLogger.getInstance();

/**
 * Express/Next.js用のミドルウェア
 */
export function createLoggingMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    const originalSend = res.send;

    res.send = function (data: any) {
      const duration = Date.now() - start;
      
      logger.apiAccess(
        req.method,
        req.url,
        res.statusCode,
        duration,
        req.headers['x-user-id'],
        req.headers['x-forwarded-for'] || req.connection.remoteAddress
      );

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * エラーハンドリング用のユーティリティ
 */
export function logError(error: Error, context?: Record<string, any>): void {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
}

/**
 * パフォーマンス測定用のユーティリティ
 */
export function measurePerformance<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = Date.now();
    
    try {
      const result = await fn();
      const duration = Date.now() - start;
      
      logger.info('PERFORMANCE', {
        operation,
        duration,
        status: 'success',
      });
      
      resolve(result);
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.error('PERFORMANCE_ERROR', {
        operation,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      
      reject(error);
    }
  });
}