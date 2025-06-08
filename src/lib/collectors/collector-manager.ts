import type { RawContentData } from '@/lib/types';
import type { UserProfile } from '@/lib/ai/types';
import { Logger } from '@/lib/utils/logger';
import { RssCollector } from './rss-collector';
import { NewsCollector } from './news-collector';
import { GitHubCollector } from './github-collector';
import { checkApiKeys } from '@/lib/config/external-apis';
import { SearchQueryGenerator } from '@/lib/ai/services/search-query-generator';
import { ContentEvaluator } from '@/lib/ai/services/content-evaluator';
import { InterestCalculator } from '@/lib/ai/services/interest-calculator';

export class CollectorManager {
  private logger: Logger;
  private collectors: Map<string, any>;
  private searchQueryGenerator: SearchQueryGenerator;
  private contentEvaluator: ContentEvaluator;
  private interestCalculator: InterestCalculator;

  constructor() {
    this.logger = new Logger('CollectorManager');
    this.collectors = new Map();
    this.searchQueryGenerator = new SearchQueryGenerator();
    this.contentEvaluator = new ContentEvaluator();
    this.interestCalculator = new InterestCalculator();
    this.initializeCollectors();
  }

  private initializeCollectors() {
    // RSSコレクターは常に利用可能
    this.collectors.set('rss', new RssCollector());

    // APIキーの存在確認
    const apiKeyStatus = checkApiKeys();

    // News APIコレクター
    if (process.env.NEWS_API_KEY) {
      this.collectors.set('news', new NewsCollector());
    } else {
      this.logger.warn('NEWS_API_KEY not found, News collector disabled');
    }

    // GitHubコレクター（認証なしでも動作）
    this.collectors.set('github', new GitHubCollector());

    if (!apiKeyStatus.hasAllKeys) {
      this.logger.warn('Some API keys are missing:', {
        missing: apiKeyStatus.missing,
      });
    }

    this.logger.info('Collectors initialized', {
      available: Array.from(this.collectors.keys()),
      hasMissingKeys: !apiKeyStatus.hasAllKeys,
    });
  }

  async collectContent(
    query: string,
    options: {
      sources?: string[];
      limit?: number;
    } = {}
  ): Promise<{
    results: RawContentData[];
    sources: string[];
    totalFound: number;
    rateLimited: string[];
  }> {
    const { sources = ['rss', 'github'], limit = 20 } = options;

    this.logger.info('Starting content collection', {
      query,
      sources,
      limit,
    });

    const allResults: RawContentData[] = [];
    const usedSources: string[] = [];
    const rateLimited: string[] = [];

    // 各ソースから収集
    for (const sourceName of sources) {
      const collector = this.collectors.get(sourceName);

      if (!collector) {
        this.logger.warn(`Collector not found: ${sourceName}`);
        continue;
      }

      try {
        // レート制限チェック
        if (await collector.isRateLimited()) {
          this.logger.warn(`Collector rate limited: ${sourceName}`);
          rateLimited.push(sourceName);
          continue;
        }

        // 各ソースから同じ数ずつ収集
        const perSourceLimit = Math.ceil(limit / sources.length);
        const results = await collector.collect(query, perSourceLimit);

        if (results.length > 0) {
          allResults.push(...results);
          usedSources.push(sourceName);
          this.logger.info(`Collected ${results.length} items from ${sourceName}`);
        }
      } catch (error) {
        this.logger.error(`Error collecting from ${sourceName}`, error as Error);
      }
    }

    // 重複除去と制限適用
    const uniqueResults = this.removeDuplicates(allResults);
    const finalResults = uniqueResults.slice(0, limit);

    this.logger.info('Collection completed', {
      totalFound: finalResults.length,
      sources: usedSources,
      rateLimited,
    });

    return {
      results: finalResults,
      sources: usedSources,
      totalFound: finalResults.length,
      rateLimited,
    };
  }

  async getCollectorStatus(): Promise<{
    available: string[];
    rateLimited: { name: string; nextAvailableAt: Date | null }[];
    apiKeysStatus: { hasAllKeys: boolean; missing: string[] };
  }> {
    const available: string[] = [];
    const rateLimited: { name: string; nextAvailableAt: Date | null }[] = [];

    for (const [name, collector] of this.collectors) {
      if (await collector.isRateLimited()) {
        const nextAvailable = await collector.getNextAvailableTime();
        rateLimited.push({ name, nextAvailableAt: nextAvailable });
      } else {
        available.push(name);
      }
    }

    return {
      available,
      rateLimited,
      apiKeysStatus: checkApiKeys(),
    };
  }

  private removeDuplicates(items: RawContentData[]): RawContentData[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });
  }

  // テスト用メソッド
  async testCollectors(): Promise<
    Record<string, { success: boolean; error?: string; count: number }>
  > {
    const results: Record<string, { success: boolean; error?: string; count: number }> = {};

    // 各コレクターをテスト
    for (const [name, collector] of this.collectors) {
      try {
        const testResults = await collector.collect('test', 3);
        results[name] = { success: true, count: testResults.length };
        this.logger.info(`Test successful for ${name}: ${testResults.length} items`);
      } catch (error) {
        results[name] = {
          success: false,
          error: (error as Error).message,
          count: 0,
        };
        this.logger.error(`Test failed for ${name}`, error as Error);
      }
    }

    return results;
  }

  // AI統合メソッド群

  /**
   * ユーザープロファイルに基づいたインテリジェント収集
   */
  async collectWithAI(
    userProfile: UserProfile,
    options: {
      sources?: string[];
      limit?: number;
      qualityThreshold?: number;
      interestThreshold?: number;
      usePersonalization?: boolean;
    } = {}
  ): Promise<{
    results: RawContentData[];
    aiMetrics: {
      totalGenerated: number;
      queriesUsed: number;
      qualityFiltered: number;
      interestFiltered: number;
      averageQuality: number;
      averageInterest: number;
    };
    recommendations: string[];
  }> {
    const {
      sources = ['rss', 'github'],
      limit = 20,
      qualityThreshold = 6,
      interestThreshold = 5,
    } = options;

    this.logger.info('Starting AI-powered collection', {
      userId: userProfile.id,
      sources,
      limit,
      qualityThreshold,
      interestThreshold,
    });

    try {
      // 1. AIでユーザーに最適化された検索クエリを生成
      const queryResult = await this.searchQueryGenerator.generateQueries(userProfile, sources, {
        maxQueriesPerSource: 3,
      });

      this.logger.info('AI-generated queries', {
        totalQueries: queryResult.queries.length,
        reasoning: queryResult.reasoning,
      });

      // 2. 生成されたクエリで収集実行
      const allResults: RawContentData[] = [];
      const usedSources: string[] = [];

      for (const query of queryResult.queries) {
        const collector = this.collectors.get(query.source);
        if (!collector) continue;

        try {
          if (await collector.isRateLimited()) {
            this.logger.warn(`Collector rate limited: ${query.source}`);
            continue;
          }

          const results = await collector.collect(
            query.query,
            Math.ceil(limit / queryResult.queries.length)
          );
          allResults.push(...results);

          if (results.length > 0 && !usedSources.includes(query.source)) {
            usedSources.push(query.source);
          }
        } catch (error) {
          this.logger.error(`Collection failed for query: ${query.query}`, error as Error);
        }
      }

      // 3. 重複除去
      const uniqueResults = this.removeDuplicates(allResults);

      // 4. AI品質評価
      const qualityScores = await this.contentEvaluator.evaluateBatch(uniqueResults, {
        maxConcurrent: 3,
      });

      // 5. AI興味度計算
      const interestResults = await this.interestCalculator.calculateBatch(
        uniqueResults,
        userProfile,
        { maxConcurrent: 3 }
      );

      // 6. フィルタリングとランキング
      const filteredResults = interestResults
        .filter((item) => {
          const qualityScore = qualityScores.get(item.content.url) || 0;
          return qualityScore >= qualityThreshold && item.score >= interestThreshold;
        })
        .sort((a, b) => {
          const qualityA = qualityScores.get(a.content.url) || 0;
          const qualityB = qualityScores.get(b.content.url) || 0;
          // 興味度×品質の複合スコアでソート
          const scoreA = a.score * 0.6 + qualityA * 0.4;
          const scoreB = b.score * 0.6 + qualityB * 0.4;
          return scoreB - scoreA;
        })
        .slice(0, limit);

      // 7. メトリクス計算
      const qualityValues = Array.from(qualityScores.values());
      const interestValues = interestResults.map((r) => r.score);

      const aiMetrics = {
        totalGenerated: uniqueResults.length,
        queriesUsed: queryResult.queries.length,
        qualityFiltered:
          uniqueResults.length -
          Array.from(qualityScores.values()).filter((q) => q >= qualityThreshold).length,
        interestFiltered:
          interestResults.length -
          interestResults.filter((r) => r.score >= interestThreshold).length,
        averageQuality:
          qualityValues.length > 0
            ? qualityValues.reduce((a, b) => a + b, 0) / qualityValues.length
            : 0,
        averageInterest:
          interestValues.length > 0
            ? interestValues.reduce((a, b) => a + b, 0) / interestValues.length
            : 0,
      };

      // 8. レコメンデーション生成
      const recommendations = await this.generateRecommendations(
        filteredResults,
        aiMetrics,
        userProfile
      );

      this.logger.info('AI collection completed', {
        userId: userProfile.id,
        finalResults: filteredResults.length,
        aiMetrics,
      });

      return {
        results: filteredResults.map((r) => r.content),
        aiMetrics,
        recommendations,
      };
    } catch (error) {
      this.logger.error('AI collection failed', error as Error, { userId: userProfile.id });

      // フォールバック: 通常の収集を実行
      const fallbackResult = await this.collectContent('', { sources, limit });
      return {
        results: fallbackResult.results,
        aiMetrics: {
          totalGenerated: fallbackResult.results.length,
          queriesUsed: 0,
          qualityFiltered: 0,
          interestFiltered: 0,
          averageQuality: 5,
          averageInterest: 5,
        },
        recommendations: ['AI処理でエラーが発生したため、デフォルトの収集を実行しました'],
      };
    }
  }

  /**
   * レコメンデーション生成
   */
  private async generateRecommendations(
    filteredResults: any[],
    aiMetrics: any,
    _userProfile: UserProfile
  ): Promise<string[]> {
    const recommendations: string[] = [];

    if (filteredResults.length === 0) {
      recommendations.push(
        '興味に合うコンテンツが見つかりませんでした。検索条件を調整することをお勧めします。'
      );
    } else if (filteredResults.length < 5) {
      recommendations.push(
        '見つかったコンテンツが少ないです。より幅広いソースを探索してみませんか？'
      );
    }

    if (aiMetrics.averageQuality < 6) {
      recommendations.push('コンテンツの品質が低めです。より信頼性の高いソースを優先しましょう。');
    }

    if (aiMetrics.averageInterest < 6) {
      recommendations.push(
        '興味度が低めのコンテンツが多いです。プロファイルの更新を検討してください。'
      );
    }

    if (aiMetrics.averageQuality > 8 && aiMetrics.averageInterest > 8) {
      recommendations.push(
        '高品質で興味深いコンテンツが見つかりました！このタイプの検索を続けることをお勧めします。'
      );
    }

    return recommendations;
  }

  /**
   * AI診断とパフォーマンス分析
   */
  async performAIDiagnostics(): Promise<{
    services: {
      searchQueryGenerator: { available: boolean; responseTime?: number };
      contentEvaluator: { available: boolean; responseTime?: number };
      interestCalculator: { available: boolean; responseTime?: number };
    };
    recommendations: string[];
    overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const services = {
      searchQueryGenerator: { available: false, responseTime: undefined as number | undefined },
      contentEvaluator: { available: false, responseTime: undefined as number | undefined },
      interestCalculator: { available: false, responseTime: undefined as number | undefined },
    };

    // テスト用のダミーデータ
    const testUserProfile: UserProfile = {
      id: 'test',
      interests: ['test'],
      techLevel: 'intermediate',
      preferredTopics: ['test'],
      recentActivity: [],
      languagePreference: 'ja',
      contentTypes: ['tutorial'],
    };

    const testContent: RawContentData = {
      title: 'Test Content',
      url: 'https://test.com',
      summary: 'Test summary',
      publishedAt: new Date().toISOString(),
      source: 'test',
      type: 'test',
      metadata: {},
    };

    // Search Query Generator テスト
    try {
      const queryStart = Date.now();
      await this.searchQueryGenerator.generateQueries(testUserProfile, ['rss'], {
        maxQueriesPerSource: 1,
      });
      services.searchQueryGenerator.available = true;
      services.searchQueryGenerator.responseTime = Date.now() - queryStart;
    } catch (error) {
      this.logger.warn('Search Query Generator diagnostic failed', error as Error);
    }

    // Content Evaluator テスト
    try {
      const evalStart = Date.now();
      await this.contentEvaluator.evaluate(testContent);
      services.contentEvaluator.available = true;
      services.contentEvaluator.responseTime = Date.now() - evalStart;
    } catch (error) {
      this.logger.warn('Content Evaluator diagnostic failed', error as Error);
    }

    // Interest Calculator テスト
    try {
      const interestStart = Date.now();
      await this.interestCalculator.calculate(testContent, testUserProfile);
      services.interestCalculator.available = true;
      services.interestCalculator.responseTime = Date.now() - interestStart;
    } catch (error) {
      this.logger.warn('Interest Calculator diagnostic failed', error as Error);
    }

    // 全体的な健康状態を判定
    const availableServices = Object.values(services).filter((s) => s.available).length;
    const totalServices = Object.keys(services).length;

    let overallHealth: 'healthy' | 'degraded' | 'unhealthy';
    if (availableServices === totalServices) {
      overallHealth = 'healthy';
    } else if (availableServices >= totalServices / 2) {
      overallHealth = 'degraded';
    } else {
      overallHealth = 'unhealthy';
    }

    // レコメンデーション生成
    const recommendations: string[] = [];

    if (!services.searchQueryGenerator.available) {
      recommendations.push(
        '検索クエリ生成サービスが利用できません。手動でクエリを指定してください。'
      );
    }

    if (!services.contentEvaluator.available) {
      recommendations.push(
        'コンテンツ評価サービスが利用できません。品質フィルタリングが適用されません。'
      );
    }

    if (!services.interestCalculator.available) {
      recommendations.push(
        '興味度計算サービスが利用できません。パーソナライゼーションが制限されます。'
      );
    }

    if (overallHealth === 'healthy') {
      recommendations.push('すべてのAIサービスが正常に動作しています。');
    }

    return {
      services,
      recommendations,
      overallHealth,
    };
  }
}
