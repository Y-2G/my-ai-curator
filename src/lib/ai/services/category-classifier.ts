import aiClient from '../client';
import promptManager from '../prompts';
import type { CategoryClassification } from '../types';
import type { RawContentData } from '@/lib/types';
import { Logger } from '@/lib/utils/logger';

export class CategoryClassifier {
  private logger: Logger;
  private classificationCache: Map<
    string,
    { classification: CategoryClassification; timestamp: number }
  >;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24時間
  private availableCategories: string[];

  constructor() {
    this.logger = new Logger('CategoryClassifier');
    this.classificationCache = new Map();
    this.availableCategories = this.getDefaultCategories();
  }

  /**
   * コンテンツを適切なカテゴリに分類
   */
  async classify(
    content: RawContentData | { title: string; summary: string },
    options: {
      customCategories?: string[];
      includeConfidence?: boolean;
      maxAlternatives?: number;
    } = {}
  ): Promise<string> {
    const classification = await this.classifyDetailed(content, options);
    return classification.category;
  }

  /**
   * 詳細な分類結果を取得
   */
  async classifyDetailed(
    content: RawContentData | { title: string; summary: string },
    options: {
      customCategories?: string[];
      includeConfidence?: boolean;
      maxAlternatives?: number;
    } = {}
  ): Promise<CategoryClassification> {
    const { customCategories, maxAlternatives = 3 } = options;

    const categories = customCategories || this.availableCategories;
    const cacheKey = this.getCacheKey(content, categories);

    // キャッシュチェック
    const cached = this.classificationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.info('Using cached classification', {
        title: content.title.slice(0, 50),
        category: cached.classification.category,
      });
      return cached.classification;
    }

    try {
      const variables = {
        title: content.title,
        summary: content.summary,
        availableCategories: categories.join(', '),
      };

      const response = await aiClient.chatCompletionJSON<{
        category: string;
        confidence: number;
        alternativeCategories: Array<{
          name: string;
          confidence: number;
        }>;
        reasoning: string;
      }>(
        [
          {
            role: 'user',
            content: promptManager.renderTemplate('category-classification', variables),
          },
        ],
        {
          description: 'Content category classification',
          properties: {
            category: { type: 'string' },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
            alternativeCategories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  confidence: { type: 'number' },
                },
              },
            },
            reasoning: { type: 'string' },
          },
        },
        {
          model: 'gpt-4o-mini',
          temperature: 0.3,
          maxTokens: 500,
        }
      );

      // 分類結果の検証・補正
      const validatedCategory = this.validateCategory(response.category, categories);
      const classification: CategoryClassification = {
        category: validatedCategory,
        confidence: Math.max(0, Math.min(1, response.confidence)),
        alternativeCategories: response.alternativeCategories
          .filter((alt) => categories.includes(alt.name))
          .slice(0, maxAlternatives),
        reasoning: response.reasoning,
      };

      // キャッシュに保存
      this.classificationCache.set(cacheKey, {
        classification,
        timestamp: Date.now(),
      });

      this.logger.info('Content classified', {
        title: content.title.slice(0, 50),
        category: classification.category,
        confidence: classification.confidence,
      });

      return classification;
    } catch (error) {
      this.logger.error('Classification failed', error as Error, {
        title: content.title.slice(0, 50),
      });

      // フォールバック分類
      return this.getFallbackClassification(content, categories);
    }
  }

  /**
   * バッチ分類
   */
  async classifyBatch(
    contents: Array<RawContentData | { title: string; summary: string }>,
    options: {
      customCategories?: string[];
      maxConcurrent?: number;
    } = {}
  ): Promise<Map<string, CategoryClassification>> {
    const { maxConcurrent = 5 } = options;
    const results = new Map<string, CategoryClassification>();

    for (let i = 0; i < contents.length; i += maxConcurrent) {
      const batch = contents.slice(i, i + maxConcurrent);

      const promises = batch.map(async (content) => {
        try {
          const classification = await this.classifyDetailed(content, options);
          return { content, classification };
        } catch (error) {
          this.logger.warn('Batch classification failed for item', {
            error: error instanceof Error ? error.message : 'Unknown error',
            title: content.title.slice(0, 50),
          });
          return {
            content,
            classification: this.getFallbackClassification(
              content,
              options.customCategories || this.availableCategories
            ),
          };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach((result) => {
        const key = this.getContentKey(result.content);
        results.set(key, result.classification);
      });

      // レート制限対策
      if (i + maxConcurrent < contents.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.info('Batch classification completed', {
      totalContents: contents.length,
      classifiedContents: results.size,
    });

    return results;
  }

  /**
   * カテゴリ統計分析
   */
  async analyzeCategoryDistribution(
    contents: Array<RawContentData | { title: string; summary: string }>,
    customCategories?: string[]
  ): Promise<{
    distribution: Record<string, number>;
    percentages: Record<string, number>;
    recommendations: string[];
    trendingCategories: string[];
  }> {
    const classifications = await this.classifyBatch(contents, { customCategories });

    const distribution: Record<string, number> = {};
    const categories = customCategories || this.availableCategories;

    // 初期化
    categories.forEach((category) => {
      distribution[category] = 0;
    });

    // カウント
    classifications.forEach((classification) => {
      distribution[classification.category] = (distribution[classification.category] || 0) + 1;
    });

    // パーセンテージ計算
    const total = contents.length;
    const percentages: Record<string, number> = {};
    Object.entries(distribution).forEach(([category, count]) => {
      percentages[category] = Math.round((count / total) * 100 * 10) / 10;
    });

    // トレンド分析
    const trendingCategories = Object.entries(distribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    // レコメンデーション生成
    const recommendations = this.generateDistributionRecommendations(distribution, percentages);

    return {
      distribution,
      percentages,
      recommendations,
      trendingCategories,
    };
  }

  /**
   * カスタムカテゴリの設定
   */
  setAvailableCategories(categories: string[]): void {
    this.availableCategories = categories;
    this.logger.info('Updated available categories', {
      categoriesCount: categories.length,
      categories: categories.slice(0, 5), // 最初の5個をログ
    });
  }

  /**
   * カテゴリの追加
   */
  addCategory(category: string): void {
    if (!this.availableCategories.includes(category)) {
      this.availableCategories.push(category);
      this.logger.info('Added new category', { category });
    }
  }

  /**
   * カテゴリの削除
   */
  removeCategory(category: string): void {
    const index = this.availableCategories.indexOf(category);
    if (index > -1) {
      this.availableCategories.splice(index, 1);
      this.logger.info('Removed category', { category });
    }
  }

  /**
   * カテゴリの信頼度評価
   */
  async evaluateCategoryAccuracy(
    testData: Array<{
      content: RawContentData | { title: string; summary: string };
      expectedCategory: string;
    }>
  ): Promise<{
    overallAccuracy: number;
    categoryAccuracy: Record<string, number>;
    confusionMatrix: Record<string, Record<string, number>>;
    suggestions: string[];
  }> {
    const results: Array<{
      expected: string;
      predicted: string;
      correct: boolean;
    }> = [];
    const confusionMatrix: Record<string, Record<string, number>> = {};

    for (const testItem of testData) {
      const predicted = await this.classify(testItem.content);
      results.push({
        expected: testItem.expectedCategory,
        predicted,
        correct: predicted === testItem.expectedCategory,
      });

      // 混同行列の更新
      if (!confusionMatrix[testItem.expectedCategory]) {
        confusionMatrix[testItem.expectedCategory] = {};
      }
      confusionMatrix[testItem.expectedCategory][predicted] =
        (confusionMatrix[testItem.expectedCategory][predicted] || 0) + 1;
    }

    // 精度計算
    const correctPredictions = results.filter((r) => r.correct).length;
    const overallAccuracy = correctPredictions / results.length;

    // カテゴリ別精度
    const categoryAccuracy: Record<string, number> = {};
    this.availableCategories.forEach((category) => {
      const categoryResults = results.filter((r) => r.expected === category);
      const categoryCorrect = categoryResults.filter((r) => r.correct).length;
      categoryAccuracy[category] =
        categoryResults.length > 0 ? categoryCorrect / categoryResults.length : 0;
    });

    // 改善提案
    const suggestions = this.generateAccuracySuggestions(
      overallAccuracy,
      categoryAccuracy,
      confusionMatrix
    );

    return {
      overallAccuracy: Math.round(overallAccuracy * 100) / 100,
      categoryAccuracy,
      confusionMatrix,
      suggestions,
    };
  }

  /**
   * プライベートメソッド群
   */
  private getDefaultCategories(): string[] {
    return [
      'フロントエンド開発',
      'バックエンド開発',
      'モバイル開発',
      'DevOps・インフラ',
      'データサイエンス・AI',
      'セキュリティ',
      'データベース',
      'ツール・ライブラリ',
      'プログラミング言語',
      'Web技術',
      'アーキテクチャ・設計',
      'テスト・品質保証',
      'プロジェクト管理',
      'キャリア・学習',
      'その他',
    ];
  }

  private getCacheKey(
    content: RawContentData | { title: string; summary: string },
    categories: string[]
  ): string {
    const contentKey = `${content.title}:${content.summary.slice(0, 100)}`;
    const categoriesKey = categories.sort().join('|');
    return `${contentKey}:${categoriesKey}`;
  }

  private getContentKey(content: RawContentData | { title: string; summary: string }): string {
    return `${content.title}:${content.summary.slice(0, 50)}`;
  }

  private validateCategory(category: string, availableCategories: string[]): string {
    // 完全一致チェック
    if (availableCategories.includes(category)) {
      return category;
    }

    // 類似カテゴリ検索
    const normalizedCategory = category.toLowerCase();
    const similar = availableCategories.find(
      (cat) =>
        cat.toLowerCase().includes(normalizedCategory) ||
        normalizedCategory.includes(cat.toLowerCase())
    );

    if (similar) {
      this.logger.info('Found similar category', { original: category, mapped: similar });
      return similar;
    }

    // フォールバック
    this.logger.warn('Unknown category, using fallback', { category });
    return 'その他';
  }

  private getFallbackClassification(
    content: RawContentData | { title: string; summary: string },
    categories: string[]
  ): CategoryClassification {
    // 簡易的なキーワードベース分類
    const text = (content.title + ' ' + content.summary).toLowerCase();

    const keywordMap = {
      フロントエンド開発: ['react', 'vue', 'angular', 'javascript', 'css', 'html', 'frontend'],
      バックエンド開発: ['node.js', 'python', 'java', 'api', 'server', 'backend'],
      モバイル開発: ['ios', 'android', 'mobile', 'react native', 'flutter'],
      'データサイエンス・AI': ['ai', 'machine learning', 'data', 'python', 'analytics'],
      'DevOps・インフラ': ['docker', 'kubernetes', 'aws', 'cloud', 'devops'],
    };

    for (const [category, keywords] of Object.entries(keywordMap)) {
      if (categories.includes(category) && keywords.some((keyword) => text.includes(keyword))) {
        return {
          category,
          confidence: 0.6,
          alternativeCategories: [],
          reasoning: 'キーワードベースの分類（フォールバック）',
        };
      }
    }

    return {
      category: 'その他',
      confidence: 0.3,
      alternativeCategories: [],
      reasoning: 'フォールバック分類',
    };
  }

  private generateDistributionRecommendations(
    distribution: Record<string, number>,
    percentages: Record<string, number>
  ): string[] {
    const recommendations: string[] = [];

    const sortedCategories = Object.entries(percentages).sort(([, a], [, b]) => b - a);

    const topCategory = sortedCategories[0];
    const bottomCategories = sortedCategories.filter(([, percent]) => percent < 5);

    if (topCategory[1] > 50) {
      recommendations.push(
        `「${topCategory[0]}」カテゴリが過半数（${topCategory[1]}%）を占めています。コンテンツの多様性を増やすことを検討してください。`
      );
    }

    if (bottomCategories.length > 3) {
      recommendations.push(
        `${bottomCategories.length}個のカテゴリがほとんど使用されていません。カテゴリの統合を検討してください。`
      );
    }

    const emptyCategories = Object.entries(distribution).filter(([, count]) => count === 0);
    if (emptyCategories.length > 0) {
      recommendations.push(
        `未使用のカテゴリがあります: ${emptyCategories.map(([cat]) => cat).join(', ')}`
      );
    }

    return recommendations;
  }

  private generateAccuracySuggestions(
    overallAccuracy: number,
    categoryAccuracy: Record<string, number>,
    confusionMatrix: Record<string, Record<string, number>>
  ): string[] {
    const suggestions: string[] = [];

    if (overallAccuracy < 0.8) {
      suggestions.push(
        '全体的な分類精度が低いです。カテゴリの定義を見直すか、プロンプトの改善を検討してください。'
      );
    }

    const lowAccuracyCategories = Object.entries(categoryAccuracy)
      .filter(([, accuracy]) => accuracy < 0.7)
      .map(([category]) => category);

    if (lowAccuracyCategories.length > 0) {
      suggestions.push(
        `分類精度の低いカテゴリ: ${lowAccuracyCategories.join(', ')}。これらのカテゴリの定義を明確にしてください。`
      );
    }

    // 混同しやすいカテゴリペアを特定
    Object.entries(confusionMatrix).forEach(([expected, predictions]) => {
      const total = Object.values(predictions).reduce((sum, count) => sum + count, 0);
      Object.entries(predictions).forEach(([predicted, count]) => {
        if (expected !== predicted && count / total > 0.3) {
          suggestions.push(
            `「${expected}」と「${predicted}」が混同されやすいです。カテゴリ定義の区別を明確にしてください。`
          );
        }
      });
    });

    return suggestions;
  }
}
