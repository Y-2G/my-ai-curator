import aiClient from '../client';
import promptManager from '../prompts';
import type { UserProfile, GeneratedSearchQueries, SearchQuery } from '../types';
import { Logger } from '@/lib/utils/logger';

export class SearchQueryGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('SearchQueryGenerator');
  }

  /**
   * ユーザープロファイルに基づいて検索クエリを生成
   */
  async generateQueries(
    userProfile: UserProfile,
    targetSources: string[] = ['google', 'news', 'reddit', 'github', 'rss'],
    options: {
      maxQueriesPerSource?: number;
      includeAdvanced?: boolean;
      language?: 'ja' | 'en' | 'both';
    } = {}
  ): Promise<GeneratedSearchQueries> {
    const {
      maxQueriesPerSource = 3,
      includeAdvanced: _includeAdvanced = userProfile.techLevel === 'expert',
      language = userProfile.languagePreference
    } = options;

    try {
      this.logger.info('Generating search queries', {
        userId: userProfile.id,
        targetSources,
        options,
      });

      // プロンプトに渡す変数を準備
      const variables = {
        userInterests: userProfile.interests.join(', '),
        techLevel: userProfile.techLevel,
        recentTopics: userProfile.recentActivity.join(', '),
        contentTypes: userProfile.contentTypes.join(', '),
        language: language,
      };

      // AIでクエリ生成
      const response = await aiClient.chatCompletionJSON<{
        queries: SearchQuery[];
        reasoning: string;
      }>(
        [
          {
            role: 'user',
            content: promptManager.renderTemplate('search-query-generation', variables)
          }
        ],
        {
          description: 'Search query generation response',
          properties: {
            queries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  source: { type: 'string' },
                  priority: { type: 'number' },
                  keywords: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            reasoning: { type: 'string' }
          }
        },
        {
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 1500,
        }
      );

      // 結果をフィルタリング・最適化
      const optimizedQueries = this.optimizeQueries(
        response.queries,
        targetSources,
        maxQueriesPerSource,
        userProfile
      );

      const result: GeneratedSearchQueries = {
        queries: optimizedQueries,
        userProfile,
        reasoning: response.reasoning,
      };

      this.logger.info('Search queries generated successfully', {
        userId: userProfile.id,
        totalQueries: optimizedQueries.length,
        sourceDistribution: this.getSourceDistribution(optimizedQueries),
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to generate search queries', error as Error, {
        userId: userProfile.id,
        targetSources,
      });
      
      // フォールバック: デフォルトクエリを返す
      return this.generateFallbackQueries(userProfile, targetSources);
    }
  }

  /**
   * 特定のトピックに対する追加クエリ生成
   */
  async generateTopicQueries(
    topic: string,
    userProfile: UserProfile,
    sources: string[] = ['google', 'news']
  ): Promise<SearchQuery[]> {
    try {
      const variables = {
        userInterests: `${topic}, ${userProfile.interests.join(', ')}`,
        techLevel: userProfile.techLevel,
        recentTopics: topic,
        contentTypes: userProfile.contentTypes.join(', '),
        language: userProfile.languagePreference,
      };

      const response = await aiClient.chatCompletionJSON<{
        queries: SearchQuery[];
        reasoning: string;
      }>(
        [
          {
            role: 'user',
            content: `特定のトピック「${topic}」に関する検索クエリを生成してください。\n\n` + 
                     promptManager.renderTemplate('search-query-generation', variables)
          }
        ],
        {
          description: 'Topic-specific search queries',
          properties: {
            queries: { type: 'array' },
            reasoning: { type: 'string' }
          }
        },
        {
          model: 'gpt-4o-mini',
          temperature: 0.6,
          maxTokens: 800,
        }
      );

      return response.queries.filter(q => sources.includes(q.source));

    } catch (error) {
      this.logger.error('Failed to generate topic queries', error as Error, { topic });
      return this.generateFallbackTopicQueries(topic, sources);
    }
  }

  /**
   * トレンド・時事ネタに特化したクエリ生成
   */
  async generateTrendingQueries(
    userProfile: UserProfile,
    timeframe: 'today' | 'week' | 'month' = 'week'
  ): Promise<SearchQuery[]> {
    const trendKeywords = this.getTrendKeywords(timeframe);
    const userInterests = userProfile.interests.join(', ');

    try {
      const prompt = `
最新のトレンドを踏まえた検索クエリを生成してください。

# ユーザーの興味: ${userInterests}
# 技術レベル: ${userProfile.techLevel}
# 期間: ${timeframe}
# トレンドキーワード: ${trendKeywords.join(', ')}

最新の技術トレンド、アップデート、ニュースを捉える検索クエリを作成してください。
JSON形式で出力してください。
`;

      const response = await aiClient.chatCompletionJSON<{
        queries: SearchQuery[];
      }>(
        [{ role: 'user', content: prompt }],
        {
          description: 'Trending search queries',
          properties: {
            queries: { type: 'array' }
          }
        },
        {
          model: 'gpt-4o-mini',
          temperature: 0.8,
          maxTokens: 1000,
        }
      );

      return response.queries;

    } catch (error) {
      this.logger.error('Failed to generate trending queries', error as Error);
      return [];
    }
  }

  /**
   * クエリを最適化・フィルタリング
   */
  private optimizeQueries(
    queries: SearchQuery[],
    targetSources: string[],
    maxQueriesPerSource: number,
    userProfile: UserProfile
  ): SearchQuery[] {
    // ソースでフィルタリング
    const filteredQueries = queries.filter(q => targetSources.includes(q.source));

    // ソースごとにグループ化
    const groupedBySources = new Map<string, SearchQuery[]>();
    filteredQueries.forEach(query => {
      if (!groupedBySources.has(query.source)) {
        groupedBySources.set(query.source, []);
      }
      groupedBySources.get(query.source)!.push(query);
    });

    // 各ソースから優先度順に選択
    const optimizedQueries: SearchQuery[] = [];
    groupedBySources.forEach((sourceQueries, source) => {
      const sorted = sourceQueries
        .sort((a, b) => b.priority - a.priority)
        .slice(0, maxQueriesPerSource);
      
      // ソース固有の最適化
      const optimized = this.optimizeForSource(sorted, source, userProfile);
      optimizedQueries.push(...optimized);
    });

    return optimizedQueries;
  }

  /**
   * ソース固有の最適化
   */
  private optimizeForSource(
    queries: SearchQuery[],
    source: string,
    _userProfile: UserProfile
  ): SearchQuery[] {
    switch (source) {
      case 'reddit':
        return queries.map(q => ({
          ...q,
          query: `${q.query} site:reddit.com`,
        }));
      
      case 'github':
        return queries.map(q => ({
          ...q,
          query: q.query.includes('language:') ? q.query : `${q.query} language:typescript OR language:javascript`,
        }));
      
      case 'news':
        return queries.map(q => ({
          ...q,
          query: `${q.query} ${new Date().getFullYear()}`,
        }));
      
      default:
        return queries;
    }
  }

  /**
   * フォールバック用のデフォルトクエリ生成
   */
  private generateFallbackQueries(
    userProfile: UserProfile,
    targetSources: string[]
  ): GeneratedSearchQueries {
    const baseQueries = [
      'TypeScript best practices',
      'React new features',
      'JavaScript performance',
      'Next.js tutorial',
      'web development trends',
    ];

    const queries: SearchQuery[] = [];
    
    targetSources.forEach(source => {
      baseQueries.slice(0, 2).forEach((baseQuery, index) => {
        queries.push({
          query: baseQuery,
          source,
          priority: 5 - index,
          keywords: baseQuery.split(' '),
        });
      });
    });

    return {
      queries,
      userProfile,
      reasoning: 'フォールバック: デフォルトクエリを使用',
    };
  }

  /**
   * トピック固有のフォールバッククエリ
   */
  private generateFallbackTopicQueries(
    topic: string,
    sources: string[]
  ): SearchQuery[] {
    const queries: SearchQuery[] = [];
    
    sources.forEach(source => {
      queries.push({
        query: `${topic} tutorial`,
        source,
        priority: 8,
        keywords: [topic, 'tutorial'],
      });
      
      queries.push({
        query: `${topic} best practices`,
        source,
        priority: 7,
        keywords: [topic, 'best practices'],
      });
    });

    return queries;
  }

  /**
   * トレンドキーワード取得
   */
  private getTrendKeywords(timeframe: string): string[] {
    const currentYear = new Date().getFullYear();
    
    const baseKeywords = [
      'AI', 'machine learning', 'TypeScript', 'React', 'Next.js',
      'performance', 'security', 'cloud', 'DevOps', 'API'
    ];

    switch (timeframe) {
      case 'today':
        return [...baseKeywords, 'latest', 'new', 'update'];
      case 'week':
        return [...baseKeywords, 'weekly', 'trending', currentYear.toString()];
      case 'month':
        return [...baseKeywords, 'monthly', 'review', currentYear.toString()];
      default:
        return baseKeywords;
    }
  }

  /**
   * ソース分布の統計取得
   */
  private getSourceDistribution(queries: SearchQuery[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    queries.forEach(query => {
      distribution[query.source] = (distribution[query.source] || 0) + 1;
    });
    return distribution;
  }

  /**
   * クエリのパフォーマンス分析
   */
  async analyzeQueryPerformance(
    query: SearchQuery,
    results: any[]
  ): Promise<{
    effectiveness: number;
    suggestions: string[];
  }> {
    // 結果の品質を分析し、クエリの改善提案を生成
    const effectiveness = Math.min(10, results.length * 0.5);
    const suggestions: string[] = [];

    if (results.length < 5) {
      suggestions.push('より一般的なキーワードを使用する');
    }
    
    if (results.length > 50) {
      suggestions.push('より具体的なキーワードを追加する');
    }

    return { effectiveness, suggestions };
  }
}