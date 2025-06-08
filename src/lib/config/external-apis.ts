export const EXTERNAL_API_CONFIG = {
  // Google Custom Search API
  googleSearch: {
    baseUrl: 'https://www.googleapis.com/customsearch/v1',
    rateLimit: {
      maxRequests: 100,
      windowMs: 24 * 60 * 60 * 1000, // 1日
    },
    quotaWarning: 80, // 80%でwarning
  },

  // News API
  newsApi: {
    baseUrl: 'https://newsapi.org/v2',
    rateLimit: {
      maxRequests: 1000,
      windowMs: 24 * 60 * 60 * 1000, // 1日
    },
    endpoints: {
      everything: '/everything',
      topHeadlines: '/top-headlines',
    },
  },

  // Reddit API
  reddit: {
    baseUrl: 'https://www.reddit.com',
    oauthUrl: 'https://oauth.reddit.com',
    tokenUrl: 'https://www.reddit.com/api/v1/access_token',
    rateLimit: {
      maxRequests: 60,
      windowMs: 60 * 1000, // 1分
    },
    userAgent: 'SmartCurator/1.0',
    subreddits: [
      'programming',
      'webdev',
      'typescript',
      'nextjs',
      'artificial',
      'MachineLearning',
    ],
  },

  // GitHub API
  github: {
    baseUrl: 'https://api.github.com',
    rateLimit: {
      maxRequests: 60, // 未認証の場合
      windowMs: 60 * 60 * 1000, // 1時間
    },
    endpoints: {
      trending: '/search/repositories',
      releases: '/repos/{owner}/{repo}/releases',
    },
  },

  // RSS Feeds
  rssFeeds: [
    {
      name: 'Hacker News',
      url: 'https://news.ycombinator.com/rss',
      category: 'tech',
    },
    {
      name: 'Dev.to',
      url: 'https://dev.to/feed',
      category: 'programming',
    },
    {
      name: 'CSS-Tricks',
      url: 'https://css-tricks.com/feed/',
      category: 'webdev',
    },
  ],
} as const;

// APIキーの存在確認
export function checkApiKeys() {
  const missing: string[] = [];

  if (!process.env.GOOGLE_CUSTOM_SEARCH_API_KEY) {
    missing.push('GOOGLE_CUSTOM_SEARCH_API_KEY');
  }
  if (!process.env.GOOGLE_SEARCH_ENGINE_ID) {
    missing.push('GOOGLE_SEARCH_ENGINE_ID');
  }
  if (!process.env.NEWS_API_KEY) {
    missing.push('NEWS_API_KEY');
  }
  if (!process.env.REDDIT_CLIENT_ID) {
    missing.push('REDDIT_CLIENT_ID');
  }
  if (!process.env.REDDIT_CLIENT_SECRET) {
    missing.push('REDDIT_CLIENT_SECRET');
  }

  return {
    hasAllKeys: missing.length === 0,
    missing,
  };
}