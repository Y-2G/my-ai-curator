import aiClient from '../client';
import promptManager from '../prompts';
import type { InterestScore, UserProfile } from '../types';
import type { RawContentData } from '@/lib/types';
import { Logger } from '@/lib/utils/logger';

export class InterestCalculator {
  private logger: Logger;
  private scoreCache: Map<string, { score: InterestScore; timestamp: number }>;
  private readonly CACHE_TTL = 12 * 60 * 60 * 1000; // 12時間

  constructor() {
    this.logger = new Logger('InterestCalculator');
    this.scoreCache = new Map();
  }

  /**
   * ユーザーの興味度スコアを計算
   */
  async calculate(content: RawContentData, userProfile: UserProfile): Promise<number> {
    const cacheKey = this.getCacheKey(content, userProfile);

    // キャッシュチェック
    const cached = this.scoreCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.info('Using cached interest score', {
        url: content.url,
        userId: userProfile.id,
        score: cached.score.score,
      });
      return cached.score.score;
    }

    try {
      const interestScore = await this.calculateDetailed(content, userProfile);

      // キャッシュに保存
      this.scoreCache.set(cacheKey, {
        score: interestScore,
        timestamp: Date.now(),
      });

      this.logger.info('Interest score calculated', {
        url: content.url,
        userId: userProfile.id,
        score: interestScore.score,
        matchedKeywords: interestScore.matchedKeywords,
      });

      return interestScore.score;
    } catch (error) {
      this.logger.error('Failed to calculate interest score', error as Error, {
        url: content.url,
        userId: userProfile.id,
      });

      // エラー時はフォールバック計算
      return this.calculateFallbackScore(content, userProfile);
    }
  }

  /**
   * 詳細な興味度スコア計算
   */
  async calculateDetailed(
    content: RawContentData,
    userProfile: UserProfile
  ): Promise<InterestScore> {
    const variables = {
      content: this.formatContentForPrompt(content),
      userProfile: this.formatUserProfileForPrompt(userProfile),
      recentActivity: userProfile.recentActivity.join(', '),
    };

    const response = await aiClient.chatCompletionJSON<{
      score: number;
      reasoning: string;
      factors: {
        topicRelevance: number;
        difficultyMatch: number;
        novelty: number;
        actionability: number;
      };
      matchedKeywords: string[];
    }>(
      [
        {
          role: 'user',
          content: promptManager.renderTemplate('interest-score-calculation', variables),
        },
      ],
      {
        description: 'Interest score calculation',
        properties: {
          score: { type: 'number', minimum: 1, maximum: 10 },
          reasoning: { type: 'string' },
          factors: {
            type: 'object',
            properties: {
              topicRelevance: { type: 'number', minimum: 1, maximum: 10 },
              difficultyMatch: { type: 'number', minimum: 1, maximum: 10 },
              novelty: { type: 'number', minimum: 1, maximum: 10 },
              actionability: { type: 'number', minimum: 1, maximum: 10 },
            },
          },
          matchedKeywords: { type: 'array', items: { type: 'string' } },
        },
      },
      {
        model: 'gpt-4o-mini',
        temperature: 0.3,
        maxTokens: 800,
      }
    );

    // スコアの妥当性チェック
    const score = Math.max(1, Math.min(10, Math.round(response.score * 10) / 10));

    return {
      score,
      reasoning: response.reasoning,
      factors: response.factors,
      matchedKeywords: response.matchedKeywords || [],
    };
  }

  /**
   * バッチ興味度計算
   */
  async calculateBatch(
    contents: RawContentData[],
    userProfile: UserProfile,
    options: {
      maxConcurrent?: number;
      sortByScore?: boolean;
      minScore?: number;
    } = {}
  ): Promise<Array<{ content: RawContentData; score: number; ranking: number }>> {
    const { maxConcurrent = 5, sortByScore = true, minScore = 0 } = options;
    const results: Array<{ content: RawContentData; score: number }> = [];

    // 並列処理でバッチ計算
    for (let i = 0; i < contents.length; i += maxConcurrent) {
      const batch = contents.slice(i, i + maxConcurrent);

      const promises = batch.map(async (content) => {
        try {
          const score = await this.calculate(content, userProfile);
          return { content, score };
        } catch (error) {
          this.logger.warn('Batch interest calculation failed for item', {
            error: error as Error,
            url: content.url,
          });
          return { content, score: this.calculateFallbackScore(content, userProfile) };
        }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter((result) => result.score >= minScore));

      // レート制限対策
      if (i + maxConcurrent < contents.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // ソートとランキング付け
    if (sortByScore) {
      results.sort((a, b) => b.score - a.score);
    }

    const rankedResults = results.map((result, index) => ({
      ...result,
      ranking: index + 1,
    }));

    this.logger.info('Batch interest calculation completed', {
      userId: userProfile.id,
      totalContents: contents.length,
      calculatedContents: results.length,
      averageScore: this.calculateAverageScore(results.map((r) => r.score)),
      topScore: results[0]?.score || 0,
    });

    return rankedResults;
  }

  /**
   * 興味の変化分析
   */
  async analyzeInterestTrend(
    userProfile: UserProfile,
    contentHistory: Array<{ content: RawContentData; timestamp: string; userAction?: string }>
  ): Promise<{
    trendingTopics: Array<{ topic: string; score: number; change: number }>;
    decliningTopics: Array<{ topic: string; score: number; change: number }>;
    recommendations: string[];
  }> {
    // 時期別に興味度を分析
    const recentContents = contentHistory
      .filter((item) => this.isRecentContent(item.timestamp, 30)) // 過去30日
      .map((item) => item.content);

    const olderContents = contentHistory
      .filter(
        (item) =>
          !this.isRecentContent(item.timestamp, 30) && this.isRecentContent(item.timestamp, 60)
      )
      .map((item) => item.content);

    // トピック別興味度計算
    const recentTopicScores = await this.calculateTopicScores(recentContents, userProfile);
    const olderTopicScores = await this.calculateTopicScores(olderContents, userProfile);

    const trendingTopics = this.findTrendingTopics(recentTopicScores, olderTopicScores);
    const decliningTopics = this.findDecliningTopics(recentTopicScores, olderTopicScores);
    const recommendations = this.generateTrendRecommendations(trendingTopics, decliningTopics);

    return {
      trendingTopics,
      decliningTopics,
      recommendations,
    };
  }

  /**
   * パーソナライゼーションスコア
   */
  async calculatePersonalizationScore(
    content: RawContentData,
    userProfile: UserProfile,
    userHistory: RawContentData[]
  ): Promise<{
    score: number;
    personalizationFactors: {
      historicalPreference: number;
      topicNovelty: number;
      sourcePreference: number;
      difficultyAlignment: number;
    };
    explanations: string[];
  }> {
    // 履歴ベースの嗜好分析
    const historicalPreference = this.calculateHistoricalPreference(content, userHistory);

    // トピックの新規性
    const topicNovelty = this.calculateTopicNovelty(content, userHistory);

    // ソース嗜好
    const sourcePreference = this.calculateSourcePreference(content.source, userProfile);

    // 難易度の適合性
    const difficultyAlignment = this.calculateDifficultyAlignment(content, userProfile);

    const factors = {
      historicalPreference,
      topicNovelty,
      sourcePreference,
      difficultyAlignment,
    };

    // 重み付き合計スコア
    const score =
      factors.historicalPreference * 0.3 +
      factors.topicNovelty * 0.25 +
      factors.sourcePreference * 0.2 +
      factors.difficultyAlignment * 0.25;

    const explanations = this.generatePersonalizationExplanations(factors, content);

    return {
      score: Math.round(score * 10) / 10,
      personalizationFactors: factors,
      explanations,
    };
  }

  /**
   * 興味度に基づくコンテンツフィルタリング
   */
  filterByInterest(
    scoredContents: Array<{ content: RawContentData; score: number }>,
    strategy: 'top_n' | 'threshold' | 'percentile' = 'threshold',
    parameter: number = 6 // topN個数、閾値、またはパーセンタイル
  ): RawContentData[] {
    switch (strategy) {
      case 'top_n':
        return scoredContents
          .sort((a, b) => b.score - a.score)
          .slice(0, parameter)
          .map((item) => item.content);

      case 'threshold':
        return scoredContents
          .filter((item) => item.score >= parameter)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.content);

      case 'percentile':
        const scores = scoredContents.map((item) => item.score).sort((a, b) => b - a);
        const percentileIndex = Math.floor(scores.length * (parameter / 100));
        const threshold = scores[percentileIndex] || 0;

        return scoredContents
          .filter((item) => item.score >= threshold)
          .sort((a, b) => b.score - a.score)
          .map((item) => item.content);

      default:
        return scoredContents.map((item) => item.content);
    }
  }

  /**
   * プライベートメソッド群
   */
  private getCacheKey(content: RawContentData, userProfile: UserProfile): string {
    return `${userProfile.id}:${content.url}:${content.title.slice(0, 30)}`;
  }

  private formatContentForPrompt(content: RawContentData): string {
    return `タイトル: ${content.title}\n要約: ${content.summary}\nソース: ${content.source}\n公開日: ${content.publishedAt}`;
  }

  private formatUserProfileForPrompt(userProfile: UserProfile): string {
    return `興味分野: ${userProfile.interests.join(', ')}\n技術レベル: ${userProfile.techLevel}\n好むコンテンツタイプ: ${userProfile.contentTypes.join(', ')}`;
  }

  private calculateFallbackScore(content: RawContentData, userProfile: UserProfile): number {
    let score = 5; // ベーススコア

    // 興味分野とのマッチング
    const contentText = (content.title + ' ' + content.summary).toLowerCase();
    const matchedInterests = userProfile.interests.filter((interest) =>
      contentText.includes(interest.toLowerCase())
    );
    score += Math.min(3, matchedInterests.length * 0.5);

    // ソースによる調整
    const sourceBonus =
      {
        github: 0.5,
        news: 0.3,
        rss: 0.2,
        reddit: 0.1,
      }[content.source] || 0;
    score += sourceBonus;

    // 新しさによる調整
    const hoursOld = (Date.now() - new Date(content.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 24) score += 0.5;
    else if (hoursOld > 168) score -= 0.5; // 1週間以上古い

    return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
  }

  private calculateAverageScore(scores: number[]): number {
    if (scores.length === 0) return 0;
    return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10;
  }

  private isRecentContent(timestamp: string, daysAgo: number): boolean {
    const contentDate = new Date(timestamp);
    const cutoffDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    return contentDate > cutoffDate;
  }

  private async calculateTopicScores(
    contents: RawContentData[],
    userProfile: UserProfile
  ): Promise<Map<string, number>> {
    const topicScores = new Map<string, number>();

    // 簡易的なトピック抽出（実際はより高度な手法を使用）
    const topics = this.extractTopics(contents);

    for (const topic of topics) {
      const relevantContents = contents.filter(
        (content) =>
          content.title.toLowerCase().includes(topic.toLowerCase()) ||
          content.summary.toLowerCase().includes(topic.toLowerCase())
      );

      if (relevantContents.length > 0) {
        const scores = await Promise.all(
          relevantContents.slice(0, 3).map((content) => this.calculate(content, userProfile))
        );
        const avgScore = this.calculateAverageScore(scores);
        topicScores.set(topic, avgScore);
      }
    }

    return topicScores;
  }

  private extractTopics(contents: RawContentData[]): string[] {
    const allText = contents
      .map((content) => content.title + ' ' + content.summary)
      .join(' ')
      .toLowerCase();

    // 技術キーワード抽出（簡易版）
    const techKeywords = [
      'react',
      'vue',
      'angular',
      'javascript',
      'typescript',
      'python',
      'java',
      'ai',
      'machine learning',
      'ml',
      'api',
      'database',
      'cloud',
      'aws',
      'docker',
      'kubernetes',
      'microservices',
      'security',
      'performance',
    ];

    return techKeywords.filter((keyword) => allText.includes(keyword));
  }

  private findTrendingTopics(
    recentScores: Map<string, number>,
    olderScores: Map<string, number>
  ): Array<{ topic: string; score: number; change: number }> {
    const trending: Array<{ topic: string; score: number; change: number }> = [];

    for (const [topic, recentScore] of recentScores) {
      const olderScore = olderScores.get(topic) || 5;
      const change = recentScore - olderScore;

      if (change > 0.5) {
        trending.push({ topic, score: recentScore, change });
      }
    }

    return trending.sort((a, b) => b.change - a.change).slice(0, 5);
  }

  private findDecliningTopics(
    recentScores: Map<string, number>,
    olderScores: Map<string, number>
  ): Array<{ topic: string; score: number; change: number }> {
    const declining: Array<{ topic: string; score: number; change: number }> = [];

    for (const [topic, recentScore] of recentScores) {
      const olderScore = olderScores.get(topic) || 5;
      const change = recentScore - olderScore;

      if (change < -0.5) {
        declining.push({ topic, score: recentScore, change });
      }
    }

    return declining.sort((a, b) => a.change - b.change).slice(0, 5);
  }

  private generateTrendRecommendations(
    trendingTopics: Array<{ topic: string; score: number; change: number }>,
    decliningTopics: Array<{ topic: string; score: number; change: number }>
  ): string[] {
    const recommendations: string[] = [];

    if (trendingTopics.length > 0) {
      const topTrending = trendingTopics[0];
      recommendations.push(
        `「${topTrending.topic}」への興味が高まっています。関連コンテンツの収集を増やすことをお勧めします。`
      );
    }

    if (decliningTopics.length > 0) {
      const topDeclining = decliningTopics[0];
      recommendations.push(
        `「${topDeclining.topic}」への興味が下がっています。他のトピックを探索してみませんか？`
      );
    }

    if (trendingTopics.length === 0 && decliningTopics.length === 0) {
      recommendations.push('興味の傾向が安定しています。新しい技術分野の探索をお勧めします。');
    }

    return recommendations;
  }

  private calculateHistoricalPreference(
    content: RawContentData,
    history: RawContentData[]
  ): number {
    // 過去のコンテンツとの類似度計算（簡易版）
    const contentKeywords = this.extractKeywords(content.title + ' ' + content.summary);
    const historyKeywords = history.flatMap((h) => this.extractKeywords(h.title + ' ' + h.summary));

    const matchCount = contentKeywords.filter((keyword) =>
      historyKeywords.includes(keyword)
    ).length;

    return Math.min(10, 5 + matchCount * 0.5);
  }

  private calculateTopicNovelty(content: RawContentData, history: RawContentData[]): number {
    const contentKeywords = this.extractKeywords(content.title + ' ' + content.summary);
    const historyKeywords = new Set(
      history.flatMap((h) => this.extractKeywords(h.title + ' ' + h.summary))
    );

    const novelKeywords = contentKeywords.filter((keyword) => !historyKeywords.has(keyword));
    const noveltyRatio = novelKeywords.length / Math.max(1, contentKeywords.length);

    return Math.min(10, 5 + noveltyRatio * 5);
  }

  private calculateSourcePreference(source: string, userProfile: UserProfile): number {
    // ユーザーの好むコンテンツタイプとソースの適合度
    const sourceScore =
      {
        github: userProfile.contentTypes.includes('tools') ? 8 : 6,
        news: userProfile.contentTypes.includes('news') ? 8 : 6,
        rss: 7,
        reddit: userProfile.contentTypes.includes('discussion') ? 8 : 5,
      }[source] || 5;

    return sourceScore;
  }

  private calculateDifficultyAlignment(content: RawContentData, userProfile: UserProfile): number {
    // コンテンツの難易度とユーザーレベルの適合度（簡易版）
    const contentText = (content.title + ' ' + content.summary).toLowerCase();

    const beginnerKeywords = ['tutorial', 'beginner', 'intro', 'basics', 'getting started'];
    const advancedKeywords = ['advanced', 'expert', 'deep dive', 'optimization', 'architecture'];

    const hasBeginnerKeywords = beginnerKeywords.some((keyword) => contentText.includes(keyword));
    const hasAdvancedKeywords = advancedKeywords.some((keyword) => contentText.includes(keyword));

    switch (userProfile.techLevel) {
      case 'beginner':
        return hasBeginnerKeywords ? 9 : hasAdvancedKeywords ? 3 : 6;
      case 'intermediate':
        return hasBeginnerKeywords ? 7 : hasAdvancedKeywords ? 7 : 8;
      case 'advanced':
      case 'expert':
        return hasBeginnerKeywords ? 5 : hasAdvancedKeywords ? 9 : 7;
      default:
        return 6;
    }
  }

  private generatePersonalizationExplanations(factors: any, _content: RawContentData): string[] {
    const explanations: string[] = [];

    if (factors.historicalPreference > 7) {
      explanations.push('あなたの過去の興味と高い関連性があります');
    }

    if (factors.topicNovelty > 7) {
      explanations.push('新しいトピックで学習機会になりそうです');
    }

    if (factors.sourcePreference > 7) {
      explanations.push('あなたが好むタイプのコンテンツソースです');
    }

    if (factors.difficultyAlignment > 7) {
      explanations.push('あなたの技術レベルに適した内容です');
    }

    return explanations;
  }

  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3)
      .slice(0, 10); // 最初の10個のキーワード
  }
}
