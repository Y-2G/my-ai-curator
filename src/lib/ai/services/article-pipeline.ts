import type { RawContentData, SourceType } from '@/lib/types';
import type { UserProfile, GeneratedArticle } from '../types';
import { Logger } from '@/lib/utils/logger';
import { ArticleGenerator } from './article-generator';
import { CategoryClassifier } from './category-classifier';
import { TagGenerator } from './tag-generator';
import { ContentEvaluator } from './content-evaluator';
import { InterestCalculator } from './interest-calculator';

export interface ArticlePipelineOptions {
  qualityThreshold?: number;
  interestThreshold?: number;
  maxSourcesPerArticle?: number;
  targetLength?: 'short' | 'medium' | 'long';
  style?: 'tutorial' | 'news' | 'analysis' | 'review';
  autoPublish?: boolean;
  includeDrafts?: boolean;
}

export interface PipelineResult {
  success: boolean;
  article?: GeneratedArticle & {
    qualityScore: number;
    interestScore: number;
    processingTime: number;
  };
  error?: string;
  warnings: string[];
  metadata: {
    sourcesProcessed: number;
    sourcesUsed: number;
    processingSteps: string[];
    executionTime: number;
  };
}

export interface BatchPipelineResult {
  successful: PipelineResult[];
  failed: Array<{ sources: RawContentData[]; error: string }>;
  summary: {
    totalAttempted: number;
    totalSuccessful: number;
    averageQuality: number;
    averageInterest: number;
    totalProcessingTime: number;
  };
}

/**
 * 記事生成パイプライン
 * コンテンツ収集から記事公開まで統合された自動処理
 */
export class ArticlePipeline {
  private logger: Logger;
  private articleGenerator: ArticleGenerator;
  private categoryClassifier: CategoryClassifier;
  private tagGenerator: TagGenerator;
  private contentEvaluator: ContentEvaluator;
  private interestCalculator: InterestCalculator;

  constructor() {
    this.logger = new Logger('ArticlePipeline');
    this.articleGenerator = new ArticleGenerator();
    this.categoryClassifier = new CategoryClassifier();
    this.tagGenerator = new TagGenerator();
    this.contentEvaluator = new ContentEvaluator();
    this.interestCalculator = new InterestCalculator();
  }

  /**
   * 単一記事生成パイプライン
   */
  async generateArticle(
    sources: RawContentData[],
    userProfile: UserProfile,
    options: ArticlePipelineOptions = {}
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const processingSteps: string[] = [];

    try {
      this.logger.info('Starting article generation pipeline', {
        sourcesCount: sources.length,
        userId: userProfile.id,
        options,
      });

      // 1. ソース品質フィルタリング
      processingSteps.push('source_quality_filtering');
      const qualityFilteredSources = await this.filterSourcesByQuality(
        sources,
        options.qualityThreshold || 6,
        warnings
      );

      if (qualityFilteredSources.length === 0) {
        return {
          success: false,
          error: 'No sources passed quality threshold',
          warnings,
          metadata: {
            sourcesProcessed: sources.length,
            sourcesUsed: 0,
            processingSteps,
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 2. 興味度フィルタリング
      processingSteps.push('interest_filtering');
      const interestFilteredSources = await this.filterSourcesByInterest(
        qualityFilteredSources,
        userProfile,
        options.interestThreshold || 5,
        warnings
      );

      if (interestFilteredSources.length === 0) {
        return {
          success: false,
          error: 'No sources passed interest threshold',
          warnings,
          metadata: {
            sourcesProcessed: sources.length,
            sourcesUsed: 0,
            processingSteps,
            executionTime: Date.now() - startTime,
          },
        };
      }

      // 3. ソース選択とグループ化
      processingSteps.push('source_selection');
      const selectedSources = this.selectBestSources(
        interestFilteredSources,
        options.maxSourcesPerArticle || 5
      );

      // 4. 記事生成
      processingSteps.push('article_generation');
      const generatedArticle = await this.articleGenerator.generate(selectedSources, userProfile, {
        targetLength: options.targetLength,
        style: options.style,
        includeCodeExamples: true,
      });

      // 5. カテゴリ分類
      processingSteps.push('category_classification');
      const category = await this.categoryClassifier.classify({
        title: generatedArticle.title,
        summary: generatedArticle.summary,
      });

      // 6. タグ生成
      processingSteps.push('tag_generation');
      const tags = await this.tagGenerator.generateTags(
        {
          title: generatedArticle.title,
          summary: generatedArticle.summary,
          content: generatedArticle.content,
        },
        {
          maxTags: 8,
          filterCommonTags: true,
        }
      );

      // 7. 最終品質・興味度評価
      processingSteps.push('final_evaluation');
      const [finalQualityScore, finalInterestScore] = await Promise.all([
        this.contentEvaluator.evaluate({
          title: generatedArticle.title,
          url: 'generated',
          summary: generatedArticle.summary,
          publishedAt: new Date().toISOString(),
          source: 'AI Generated',
          type: 'article',
          metadata: {},
        }),
        this.interestCalculator.calculate(
          {
            title: generatedArticle.title,
            url: 'generated',
            summary: generatedArticle.summary,
            publishedAt: new Date().toISOString(),
            source: 'AI Generated',
            type: 'article',
            metadata: {},
          },
          userProfile
        ),
      ]);

      // 8. 最終記事の構築
      const finalArticle = {
        ...generatedArticle,
        category,
        tags,
        qualityScore: finalQualityScore,
        interestScore: finalInterestScore,
        processingTime: Date.now() - startTime,
      };

      // 9. 品質チェック
      if (finalQualityScore < (options.qualityThreshold || 6)) {
        warnings.push(`Generated article quality (${finalQualityScore}) below threshold`);
      }

      if (finalInterestScore < (options.interestThreshold || 5)) {
        warnings.push(`Generated article interest (${finalInterestScore}) below threshold`);
      }

      processingSteps.push('pipeline_completed');

      this.logger.info('Article generation pipeline completed', {
        title: finalArticle.title,
        qualityScore: finalQualityScore,
        interestScore: finalInterestScore,
        processingTime: Date.now() - startTime,
        warnings: warnings.length,
      });

      return {
        success: true,
        article: finalArticle,
        warnings,
        metadata: {
          sourcesProcessed: sources.length,
          sourcesUsed: selectedSources.length,
          processingSteps,
          executionTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error('Article generation pipeline failed', error as Error, {
        sourcesCount: sources.length,
        userId: userProfile.id,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        warnings,
        metadata: {
          sourcesProcessed: sources.length,
          sourcesUsed: 0,
          processingSteps,
          executionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * バッチ記事生成パイプライン
   */
  async generateArticlesBatch(
    sourceGroups: RawContentData[][],
    userProfile: UserProfile,
    options: ArticlePipelineOptions & {
      maxConcurrent?: number;
      continueOnError?: boolean;
    } = {}
  ): Promise<BatchPipelineResult> {
    const startTime = Date.now();
    const maxConcurrent = options.maxConcurrent || 3;
    const continueOnError = options.continueOnError || false;
    const successful: PipelineResult[] = [];
    const failed: Array<{ sources: RawContentData[]; error: string }> = [];

    this.logger.info('Starting batch article generation', {
      groupsCount: sourceGroups.length,
      userId: userProfile.id,
      maxConcurrent,
    });

    for (let i = 0; i < sourceGroups.length; i += maxConcurrent) {
      const batch = sourceGroups.slice(i, i + maxConcurrent);

      const batchResults = await Promise.allSettled(
        batch.map(async (sources) => {
          try {
            const result = await this.generateArticle(sources, userProfile, options);
            return { type: 'success' as const, result };
          } catch (error) {
            return {
              type: 'failed' as const,
              sources,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.type === 'success') {
            successful.push(result.value.result);
          } else {
            failed.push({ sources: result.value.sources, error: result.value.error });
          }
        } else {
          failed.push({ sources: [], error: result.reason });
        }

        if (!continueOnError && failed.length > 0) {
          this.logger.error(
            'Batch processing stopped due to error',
            new Error(failed[failed.length - 1].error)
          );
          return {
            successful,
            failed,
            summary: {
              totalAttempted: sourceGroups.length,
              totalSuccessful: successful.length,
              averageQuality: 0,
              averageInterest: 0,
              totalProcessingTime: Date.now() - startTime,
            },
          };
        }
      }

      // レート制限対策で待機
      if (i + maxConcurrent < sourceGroups.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // サマリー計算
    const summary = this.calculateBatchSummary(successful, failed, sourceGroups.length);

    this.logger.info('Batch article generation completed', summary);

    return {
      successful,
      failed,
      summary,
    };
  }

  /**
   * パイプライン設定の最適化
   */
  async optimizePipelineSettings(
    userProfile: UserProfile,
    historicalData: {
      articles: Array<{ qualityScore: number; interestScore: number; userFeedback?: number }>;
      rejectedSources: RawContentData[];
    }
  ): Promise<{
    recommendedSettings: ArticlePipelineOptions;
    reasoning: string[];
    expectedImprovement: number;
  }> {
    const reasoning: string[] = [];
    const settings: ArticlePipelineOptions = {};

    // 履歴データ分析
    const articles = historicalData.articles;
    if (articles.length > 0) {
      const avgQuality = articles.reduce((sum, a) => sum + a.qualityScore, 0) / articles.length;
      const avgInterest = articles.reduce((sum, a) => sum + a.interestScore, 0) / articles.length;

      // 品質閾値の最適化
      if (avgQuality > 8) {
        settings.qualityThreshold = 7;
        reasoning.push('高品質記事が多いため、品質閾値を上げました');
      } else if (avgQuality < 6) {
        settings.qualityThreshold = 5;
        reasoning.push('品質向上のため、閾値を下げて多様性を確保します');
      } else {
        settings.qualityThreshold = 6;
      }

      // 興味度閾値の最適化
      if (avgInterest > 8) {
        settings.interestThreshold = 6;
        reasoning.push('高い興味度を維持するため、閾値を上げました');
      } else if (avgInterest < 5) {
        settings.interestThreshold = 4;
        reasoning.push('興味のある記事を増やすため、閾値を下げました');
      } else {
        settings.interestThreshold = 5;
      }
    }

    // ユーザープロファイルに基づく最適化
    if (userProfile.techLevel === 'beginner') {
      settings.style = 'tutorial';
      reasoning.push('初心者レベルのため、チュートリアル形式を推奨');
    } else if (userProfile.techLevel === 'expert') {
      settings.style = 'analysis';
      reasoning.push('エキスパートレベルのため、分析記事を推奨');
    }

    // 期待改善値計算（簡易版）
    const expectedImprovement = Math.min(
      0.3,
      Math.max(0, (8 - (articles[0]?.qualityScore || 6)) * 0.1)
    );

    return {
      recommendedSettings: settings,
      reasoning,
      expectedImprovement,
    };
  }

  /**
   * プライベートメソッド群
   */
  private async filterSourcesByQuality(
    sources: RawContentData[],
    threshold: number,
    warnings: string[]
  ): Promise<RawContentData[]> {
    const qualityScores = await this.contentEvaluator.evaluateBatch(sources, {
      maxConcurrent: 3,
    });

    const filtered = sources.filter((source) => {
      const score = qualityScores.get(source.url) || 0;
      return score >= threshold;
    });

    const rejected = sources.length - filtered.length;
    if (rejected > 0) {
      warnings.push(`${rejected} sources rejected due to low quality`);
    }

    return filtered;
  }

  private async filterSourcesByInterest(
    sources: RawContentData[],
    userProfile: UserProfile,
    threshold: number,
    warnings: string[]
  ): Promise<Array<RawContentData & { interestScore: number }>> {
    const interestResults = await this.interestCalculator.calculateBatch(sources, userProfile, {
      maxConcurrent: 3,
    });

    const filtered = interestResults.filter((result) => result.score >= threshold);

    const rejected = sources.length - filtered.length;
    if (rejected > 0) {
      warnings.push(`${rejected} sources rejected due to low interest`);
    }

    return filtered.map((result) => ({
      ...result.content,
      interestScore: result.score,
    }));
  }

  private selectBestSources(
    sources: Array<RawContentData & { interestScore: number }>,
    maxSources: number
  ): RawContentData[] {
    // 興味度でソートして上位を選択
    return sources
      .sort((a, b) => b.interestScore - a.interestScore)
      .slice(0, maxSources)
      .map(({ interestScore: _interestScore, ...source }) => source);
  }

  private calculateBatchSummary(
    successful: PipelineResult[],
    failed: Array<{ sources: RawContentData[]; error: string }>,
    totalAttempted: number
  ): BatchPipelineResult['summary'] {
    const totalSuccessful = successful.length;
    const averageQuality =
      successful.length > 0
        ? successful.reduce((sum, result) => sum + (result.article?.qualityScore || 0), 0) /
          successful.length
        : 0;
    const averageInterest =
      successful.length > 0
        ? successful.reduce((sum, result) => sum + (result.article?.interestScore || 0), 0) /
          successful.length
        : 0;
    const totalProcessingTime = successful.reduce(
      (sum, result) => sum + result.metadata.executionTime,
      0
    );

    return {
      totalAttempted,
      totalSuccessful,
      averageQuality: Math.round(averageQuality * 10) / 10,
      averageInterest: Math.round(averageInterest * 10) / 10,
      totalProcessingTime,
    };
  }

  /**
   * パイプライン診断
   */
  async diagnosePipeline(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, { available: boolean; responseTime?: number }>;
    recommendations: string[];
  }> {
    const services: Record<string, { available: boolean; responseTime?: number }> = {};

    // 各サービスのヘルスチェック
    const testContent: RawContentData = {
      title: 'Test Article',
      summary: 'Test summary',
      publishedAt: new Date().toISOString(),
      url: 'https://example.com',
      source: 'Test Source',
      type: 'news' as SourceType,
      metadata: {},
    };

    const testProfile: UserProfile = {
      id: 'test',
      interests: ['test'],
      techLevel: 'intermediate',
      preferredTopics: ['test'],
      recentActivity: [],
      languagePreference: 'ja',
      contentTypes: ['tutorial'],
    };

    // Article Generator
    try {
      const start = Date.now();
      await this.articleGenerator.generate([testContent], testProfile, { targetLength: 'short' });
      services.articleGenerator = { available: true, responseTime: Date.now() - start };
    } catch {
      services.articleGenerator = { available: false };
    }

    // Category Classifier
    try {
      const start = Date.now();
      await this.categoryClassifier.classify({
        title: testContent.title,
        summary: testContent.summary,
      });
      services.categoryClassifier = { available: true, responseTime: Date.now() - start };
    } catch {
      services.categoryClassifier = { available: false };
    }

    // Tag Generator
    try {
      const start = Date.now();
      await this.tagGenerator.generateTags({
        title: testContent.title,
        summary: testContent.summary,
      });
      services.tagGenerator = { available: true, responseTime: Date.now() - start };
    } catch {
      services.tagGenerator = { available: false };
    }

    // Content Evaluator
    try {
      const start = Date.now();
      await this.contentEvaluator.evaluate(testContent);
      services.contentEvaluator = { available: true, responseTime: Date.now() - start };
    } catch {
      services.contentEvaluator = { available: false };
    }

    // Interest Calculator
    try {
      const start = Date.now();
      await this.interestCalculator.calculate(testContent, testProfile);
      services.interestCalculator = { available: true, responseTime: Date.now() - start };
    } catch {
      services.interestCalculator = { available: false };
    }

    // 全体的な健康状態を判定
    const availableServices = Object.values(services).filter((s) => s.available).length;
    const totalServices = Object.keys(services).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (availableServices === totalServices) {
      status = 'healthy';
    } else if (availableServices >= totalServices * 0.6) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    // レコメンデーション生成
    const recommendations: string[] = [];

    Object.entries(services).forEach(([serviceName, serviceStatus]) => {
      if (!serviceStatus.available) {
        recommendations.push(`${serviceName} is not available - check AI service connectivity`);
      } else if (serviceStatus.responseTime && serviceStatus.responseTime > 30000) {
        recommendations.push(
          `${serviceName} is responding slowly (${serviceStatus.responseTime}ms)`
        );
      }
    });

    if (status === 'healthy') {
      recommendations.push('All pipeline services are operating normally');
    }

    return {
      status,
      services,
      recommendations,
    };
  }
}
