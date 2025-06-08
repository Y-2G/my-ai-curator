// アプリケーション定数

export const APP_NAME = 'My AI Curator';
export const APP_DESCRIPTION = '私の興味に基づいてAIが検索・紹介する個人キュレーションブログ';

// API関連
export const API_ROUTES = {
  ARTICLES: '/api/articles',
  CATEGORIES: '/api/categories',
  TAGS: '/api/tags',
  INTERNAL: {
    COLLECT: '/api/internal/collect',
    GENERATE: '/api/internal/generate',
    CRON: {
      COLLECT: '/api/internal/cron/collect',
      GENERATE: '/api/internal/cron/generate',
    },
  },
} as const;

// ページネーション
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

// 記事関連
export const ARTICLE = {
  MIN_QUALITY_SCORE: 5,
  MIN_INTEREST_SCORE: 3,
  MAX_TAGS: 10,
  TITLE_MAX_LENGTH: 200,
  SUMMARY_MAX_LENGTH: 500,
} as const;

// 情報収集
export const COLLECTION = {
  DEFAULT_LIMIT_PER_SOURCE: 10,
  MAX_SOURCES: 5,
  CACHE_DURATION: 3600, // 1時間（秒）
} as const;

// AI関連
export const AI = {
  MODEL: {
    ADVANCED: 'gpt-4o',
    BASIC: 'gpt-4o-mini',
  },
  TEMPERATURE: {
    CREATIVE: 0.7,
    PRECISE: 0.3,
  },
  MAX_TOKENS: {
    SUMMARY: 500,
    ARTICLE: 2000,
  },
} as const;

// キャッシュ
export const CACHE = {
  TTL: {
    ARTICLE_LIST: 900, // 15分
    ARTICLE_DETAIL: 3600, // 1時間
    CATEGORIES: 86400, // 1日
  },
  KEY_PREFIX: {
    ARTICLE: 'article:',
    COLLECTION: 'collection:',
    USER: 'user:',
  },
} as const;

// エラーメッセージ
export const ERROR_MESSAGES = {
  INTERNAL_SERVER_ERROR: '内部サーバーエラーが発生しました',
  NOT_FOUND: 'リソースが見つかりません',
  UNAUTHORIZED: '認証が必要です',
  RATE_LIMIT: 'レート制限に達しました',
  INVALID_REQUEST: '無効なリクエストです',
} as const;