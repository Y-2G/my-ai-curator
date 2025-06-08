import aiClient from '../client';
import promptManager from '../prompts';
import type { ContentEvaluation } from '../types';
import type { RawContentData } from '@/lib/types';
import { Logger } from '@/lib/utils/logger';

export class ContentEvaluator {
  private logger: Logger;
  private evaluationCache: Map<string, { evaluation: ContentEvaluation; timestamp: number }>;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間

  constructor() {
    this.logger = new Logger('ContentEvaluator');
    this.evaluationCache = new Map();
  }

  /**
   * コンテンツの品質を評価
   */
  async evaluate(content: RawContentData): Promise<number> {
    const cacheKey = this.getCacheKey(content);

    // キャッシュチェック
    const cached = this.evaluationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.info('Using cached evaluation', { url: content.url });
      return cached.evaluation.qualityScore;
    }

    try {
      const evaluation = await this.evaluateDetailed(content);

      // キャッシュに保存
      this.evaluationCache.set(cacheKey, {
        evaluation,
        timestamp: Date.now(),
      });

      this.logger.info('Content evaluated', {
        url: content.url,
        score: evaluation.qualityScore,
        source: content.source,
      });

      return evaluation.qualityScore;
    } catch (error) {
      this.logger.error('Failed to evaluate content', error as Error, {
        url: content.url,
        source: content.source,
      });

      // エラー時は中間値を返す
      return 5;
    }
  }

  /**
   * 詳細な品質評価
   */
  async evaluateDetailed(content: RawContentData): Promise<ContentEvaluation> {
    const variables = {
      title: content.title,
      summary: content.summary,
      source: content.source,
      publishedAt: content.publishedAt,
      contentType: content.type,
    };

    const response = await aiClient.chatCompletionJSON<{
      qualityScore: number;
      reasoning: string;
      factors: {
        accuracy: number;
        relevance: number;
        freshness: number;
        depth: number;
        readability: number;
      };
      flags: string[];
    }>(
      [
        {
          role: 'user',
          content: promptManager.renderTemplate('content-quality-evaluation', variables),
        },
      ],
      {
        description: 'Content quality evaluation',
        properties: {
          qualityScore: { type: 'number', minimum: 1, maximum: 10 },
          reasoning: { type: 'string' },
          factors: {
            type: 'object',
            properties: {
              accuracy: { type: 'number', minimum: 1, maximum: 10 },
              relevance: { type: 'number', minimum: 1, maximum: 10 },
              freshness: { type: 'number', minimum: 1, maximum: 10 },
              depth: { type: 'number', minimum: 1, maximum: 10 },
              readability: { type: 'number', minimum: 1, maximum: 10 },
            },
          },
          flags: { type: 'array', items: { type: 'string' } },
        },
      },
      {
        model: 'gpt-4o-mini',
        temperature: 0.3, // 評価は一貫性を重視
        maxTokens: 800,
      }
    );

    // スコアの妥当性チェック
    const qualityScore = Math.max(1, Math.min(10, Math.round(response.qualityScore * 10) / 10));

    return {
      qualityScore,
      reasoning: response.reasoning,
      factors: response.factors,
      flags: response.flags || [],
    };
  }

  /**
   * バッチ評価（複数コンテンツを効率的に評価）
   */
  async evaluateBatch(
    contents: RawContentData[],
    options: {
      maxConcurrent?: number;
      priorityThreshold?: number;
    } = {}
  ): Promise<Map<string, number>> {
    const { maxConcurrent = 5, priorityThreshold = 0 } = options;
    const results = new Map<string, number>();

    // 優先度の高いコンテンツから評価
    const sortedContents = contents
      .map((content) => ({
        content,
        priority: this.calculatePriority(content),
      }))
      .filter((item) => item.priority >= priorityThreshold)
      .sort((a, b) => b.priority - a.priority)
      .map((item) => item.content);

    // 並列処理でバッチ評価
    for (let i = 0; i < sortedContents.length; i += maxConcurrent) {
      const batch = sortedContents.slice(i, i + maxConcurrent);

      const promises = batch.map(async (content) => {
        try {
          const score = await this.evaluate(content);
          return { url: content.url, score };
        } catch (error) {
          this.logger.warn('Batch evaluation failed for item', {
            error: error instanceof Error ? error.message : 'Unknown error',
            url: content.url,
          });
          return { url: content.url, score: 5 };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach((result) => {
        results.set(result.url, result.score);
      });

      // レート制限対策で少し待機
      if (i + maxConcurrent < sortedContents.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.info('Batch evaluation completed', {
      totalContents: contents.length,
      evaluatedContents: results.size,
      averageScore: this.calculateAverageScore(Array.from(results.values())),
    });

    return results;
  }

  /**
   * 特定ソースの品質傾向分析
   */
  async analyzeSourceQuality(
    source: string,
    contents: RawContentData[]
  ): Promise<{
    averageScore: number;
    scoreDistribution: number[];
    commonFlags: string[];
    recommendations: string[];
  }> {
    const sourceContents = contents.filter((c) => c.source === source);

    if (sourceContents.length === 0) {
      return {
        averageScore: 0,
        scoreDistribution: [],
        commonFlags: [],
        recommendations: ['No content available for analysis'],
      };
    }

    const evaluations = await Promise.all(
      sourceContents.slice(0, 10).map((content) => this.evaluateDetailed(content))
    );

    const scores = evaluations.map((e) => e.qualityScore);
    const allFlags = evaluations.flatMap((e) => e.flags);

    const averageScore = this.calculateAverageScore(scores);
    const scoreDistribution = this.calculateScoreDistribution(scores);
    const commonFlags = this.findCommonFlags(allFlags);
    const recommendations = this.generateSourceRecommendations(averageScore, commonFlags);

    return {
      averageScore,
      scoreDistribution,
      commonFlags,
      recommendations,
    };
  }

  /**
   * 時系列での品質トレンド分析
   */
  async analyzeQualityTrend(
    contents: RawContentData[],
    timeWindow: '1day' | '1week' | '1month' = '1week'
  ): Promise<{
    trend: 'improving' | 'declining' | 'stable';
    trendScore: number; // -1 to 1
    periodScores: Array<{ period: string; score: number; count: number }>;
  }> {
    const windowMs = this.getTimeWindowMs(timeWindow);
    const now = Date.now();

    // 時間でグループ化
    const groupedByTime = new Map<string, RawContentData[]>();

    contents.forEach((content) => {
      const contentTime = new Date(content.publishedAt).getTime();
      const timeDiff = now - contentTime;

      if (timeDiff <= windowMs) {
        const periodKey = this.getPeriodKey(contentTime, timeWindow);
        if (!groupedByTime.has(periodKey)) {
          groupedByTime.set(periodKey, []);
        }
        groupedByTime.get(periodKey)!.push(content);
      }
    });

    // 各期間の平均スコア計算
    const periodScores = [];
    for (const [period, periodContents] of groupedByTime) {
      const scores = await Promise.all(
        periodContents.slice(0, 5).map((content) => this.evaluate(content))
      );

      const averageScore = this.calculateAverageScore(scores);
      periodScores.push({
        period,
        score: averageScore,
        count: periodContents.length,
      });
    }

    // トレンド分析
    const { trend, trendScore } = this.calculateTrend(periodScores);

    return {
      trend,
      trendScore,
      periodScores: periodScores.sort((a, b) => a.period.localeCompare(b.period)),
    };
  }

  /**
   * 品質フィルタリング
   */
  filterByQuality(evaluations: Map<string, number>, threshold: number = 6): string[] {
    return Array.from(evaluations.entries())
      .filter(([_, score]) => score >= threshold)
      .sort(([_, a], [__, b]) => b - a)
      .map(([url, _]) => url);
  }

  /**
   * プライベートメソッド群
   */
  private getCacheKey(content: RawContentData): string {
    return `${content.url}:${content.title.slice(0, 50)}`;
  }

  private calculatePriority(content: RawContentData): number {
    const publishedAt = new Date(content.publishedAt);
    const now = new Date();
    const hoursSincePublished = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60);

    // 新しいコンテンツほど高優先度
    const freshnessScore = Math.max(0, 10 - hoursSincePublished / 24);

    // ソースによる重み付け
    const sourceWeight =
      {
        github: 1.2,
        news: 1.1,
        rss: 1.0,
        reddit: 0.9,
      }[content.source] || 1.0;

    return freshnessScore * sourceWeight;
  }

  private calculateAverageScore(scores: number[]): number {
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  }

  private calculateScoreDistribution(scores: number[]): number[] {
    const distribution = new Array(10).fill(0);
    scores.forEach((score) => {
      const bucket = Math.min(9, Math.floor(score) - 1);
      if (bucket >= 0) distribution[bucket]++;
    });
    return distribution;
  }

  private findCommonFlags(flags: string[]): string[] {
    const flagCounts = new Map<string, number>();
    flags.forEach((flag) => {
      flagCounts.set(flag, (flagCounts.get(flag) || 0) + 1);
    });

    return Array.from(flagCounts.entries())
      .filter(([_, count]) => count >= 2)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([flag, _]) => flag);
  }

  private generateSourceRecommendations(averageScore: number, commonFlags: string[]): string[] {
    const recommendations: string[] = [];

    if (averageScore < 5) {
      recommendations.push('このソースの品質が低いため、収集頻度を下げることを検討');
    } else if (averageScore > 8) {
      recommendations.push('高品質なソースのため、収集頻度を上げることを推奨');
    }

    if (commonFlags.includes('outdated_info')) {
      recommendations.push('古い情報が多いため、新しい記事を優先的に収集');
    }

    if (commonFlags.includes('potential_bias')) {
      recommendations.push('バイアスが見られるため、他のソースとのクロスチェックを推奨');
    }

    return recommendations;
  }

  private getTimeWindowMs(timeWindow: string): number {
    switch (timeWindow) {
      case '1day':
        return 24 * 60 * 60 * 1000;
      case '1week':
        return 7 * 24 * 60 * 60 * 1000;
      case '1month':
        return 30 * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private getPeriodKey(timestamp: number, timeWindow: string): string {
    const date = new Date(timestamp);
    switch (timeWindow) {
      case '1day':
        return date.toISOString().split('T')[0];
      case '1week':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `${weekStart.toISOString().split('T')[0]}-week`;
      case '1month':
        return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      default:
        return date.toISOString().split('T')[0];
    }
  }

  private calculateTrend(periodScores: Array<{ period: string; score: number; count: number }>): {
    trend: 'improving' | 'declining' | 'stable';
    trendScore: number;
  } {
    if (periodScores.length < 2) {
      return { trend: 'stable', trendScore: 0 };
    }

    const sortedScores = periodScores.sort((a, b) => a.period.localeCompare(b.period));
    const firstHalf = sortedScores.slice(0, Math.ceil(sortedScores.length / 2));
    const secondHalf = sortedScores.slice(Math.floor(sortedScores.length / 2));

    const firstAvg = this.calculateAverageScore(firstHalf.map((p) => p.score));
    const secondAvg = this.calculateAverageScore(secondHalf.map((p) => p.score));

    const trendScore = (secondAvg - firstAvg) / 10; // -1 to 1

    let trend: 'improving' | 'declining' | 'stable';
    if (trendScore > 0.1) {
      trend = 'improving';
    } else if (trendScore < -0.1) {
      trend = 'declining';
    } else {
      trend = 'stable';
    }

    return { trend, trendScore: Math.round(trendScore * 100) / 100 };
  }
}
