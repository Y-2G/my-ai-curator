import { z } from 'zod';

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_URL_NON_POOLING: z.string().url(),

  // Cache (Optional)
  KV_URL: z.string().url().optional(),
  KV_REST_API_URL: z.string().url().optional(),
  KV_REST_API_TOKEN: z.string().optional(),

  // AI Services
  OPENAI_API_KEY: z.string().min(1),

  // External APIs (Optional for initial development)
  GOOGLE_CUSTOM_SEARCH_API_KEY: z.string().optional(),
  GOOGLE_SEARCH_ENGINE_ID: z.string().optional(),
  NEWS_API_KEY: z.string().optional(),
  REDDIT_CLIENT_ID: z.string().optional(),
  REDDIT_CLIENT_SECRET: z.string().optional(),

  // Notifications (Optional)
  SLACK_WEBHOOK_URL: z.string().url().optional(),

  // Security
  INTERNAL_API_KEY: z
    .string()
    .min(32, 'INTERNAL_API_KEY must be at least 32 characters for security'),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters for security'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .optional(),
  NEXTAUTH_SECRET: z
    .string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters for security')
    .optional(),
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters for security')
    .optional(),

  // Security settings
  ALLOWED_ORIGINS: z
    .string()
    .transform((val) => (val ? val.split(',').map((s) => s.trim()) : []))
    .optional(),
  RATE_LIMIT_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .default('true'),

  // App
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Admin
  ADMIN_USER_ID: z.string().optional(),
});

// 環境変数の検証と型安全なエクスポート
const parseEnv = () => {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
    // 開発環境では警告のみ、本番環境ではエラーとする
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid environment variables');
    }
    // 開発環境では警告のみを表示して続行（本番環境では上記でエラー終了）
    console.warn('⚠️  Using development mode with missing environment variables');

    // 開発環境でのダミー値（警告と共に使用）
    const devDefaults = {
      DATABASE_URL:
        process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/smart_curator',
      DATABASE_URL_NON_POOLING:
        process.env.DATABASE_URL_NON_POOLING ||
        'postgresql://postgres:postgres@localhost:5432/smart_curator',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || '',
      CRON_SECRET: process.env.CRON_SECRET || '',
      JWT_SECRET: process.env.JWT_SECRET || '',
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || '',
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
      ALLOWED_ORIGINS: [],
      RATE_LIMIT_ENABLED: true,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      NODE_ENV: (process.env.NODE_ENV || 'development') as 'development' | 'production' | 'test',
    };

    // セキュリティに関わる設定が不足している場合は明示的に警告
    if (!process.env.JWT_SECRET) {
      console.warn('⚠️  JWT_SECRET not set - authentication will fail');
    }
    if (!process.env.INTERNAL_API_KEY) {
      console.warn('⚠️  INTERNAL_API_KEY not set - internal APIs will fail');
    }

    return devDefaults as z.infer<typeof envSchema>;
  }

  return parsed.data;
};

export const env = parseEnv();

// 型のエクスポート
export type Env = z.infer<typeof envSchema>;
