// AI関連の型定義

export interface UserInterestProfile {
  id: string;
  name: string;
  email: string;
  profile?: {
    preferredStyle?: 'technical' | 'casual' | 'balanced';
    bio?: string;
    location?: string;
  };
  interests?: {
    categories?: string[];
    tags?: string[];
    keywords?: string[];
  };
  userInterests?: Array<{
    keyword: string;
    weight: number;
    lastUsed: string;
  }>;
}

export interface SearchQuery {
  query: string;
  category: string;
  priority: number;
  reasoning: string;
  sources: string[];
}

export interface UserProfile {
  id: string;
  interests: string[];
  preferredTopics: string[];
  recentActivity: string[];
  languagePreference: 'ja' | 'en' | 'both';
  contentTypes: (
    | 'tutorial'
    | 'news'
    | 'research'
    | 'tools'
    | 'discussion'
    | 'guide'
    | 'analysis'
  )[];
}

export interface ContentEvaluation {
  qualityScore: number; // 1-10
  reasoning: string;
  factors: {
    accuracy: number;
    relevance: number;
    freshness: number;
    depth: number;
    readability: number;
  };
  flags: string[]; // potential issues
}

export interface InterestScore {
  score: number; // 1-10
  reasoning: string;
  factors: {
    topicRelevance: number;
    difficultyMatch: number;
    novelty: number;
    actionability: number;
  };
  matchedKeywords: string[];
}

export interface GeneratedArticle {
  title: string;
  summary: string;
  content: string; // Markdown format
  category: string;
  tags: string[];
  sources: ArticleSource[];
  confidence: number;
  metadata: {
    wordCount: number;
    readingTime: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    contentType: 'tutorial' | 'news' | 'analysis' | 'review';
  };
}

export interface ArticleSource {
  url: string;
  title: string;
  type: string;
  relevance: number;
}

export interface CategoryClassification {
  category: string;
  confidence: number;
  alternativeCategories: Array<{
    name: string;
    confidence: number;
  }>;
  reasoning: string;
}

export interface TagSuggestions {
  tags: Array<{
    name: string;
    relevance: number;
    type: 'technology' | 'topic' | 'difficulty' | 'content-type';
  }>;
  reasoning: string;
}

// プロンプト管理用の型
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'search' | 'evaluation' | 'generation' | 'classification';
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptExecution {
  templateId: string;
  variables: Record<string, string>;
  model: string;
  temperature: number;
  maxTokens: number;
}

// エラー処理用の型
export interface AIError {
  code: 'RATE_LIMIT' | 'INVALID_RESPONSE' | 'API_ERROR' | 'TIMEOUT' | 'PARSE_ERROR';
  message: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  context?: Record<string, any>;
}

// バッチ処理用の型
export interface BatchRequest<T> {
  id: string;
  input: T;
  priority: number;
}

export interface BatchResponse<T, R> {
  id: string;
  input: T;
  output?: R;
  error?: AIError;
  duration: number;
  tokensUsed: number;
}

// 統計・メトリクス用の型
export interface AIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  estimatedCost: number;
  errorsByType: Record<string, number>;
  modelUsage: Record<string, number>;
  lastUpdated: string;
}
