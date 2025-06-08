import aiClient from '../client';
import promptManager from '../prompts';
import type { TagSuggestions } from '../types';
import type { RawContentData } from '@/lib/types';
import { Logger } from '@/lib/utils/logger';

type TagType = 'technology' | 'topic' | 'difficulty' | 'content-type';

interface Tag {
  name: string;
  relevance: number;
  type: TagType;
}

export class TagGenerator {
  private logger: Logger;
  private tagCache: Map<string, { tags: TagSuggestions; timestamp: number }>;
  private readonly CACHE_TTL = 12 * 60 * 60 * 1000; // 12時間
  private commonTags: Set<string>;
  private tagFrequency: Map<string, number>;

  constructor() {
    this.logger = new Logger('TagGenerator');
    this.tagCache = new Map();
    this.commonTags = new Set();
    this.tagFrequency = new Map();
    this.initializeCommonTags();
  }

  /**
   * コンテンツから関連タグを生成
   */
  async generateTags(
    content: RawContentData | { title: string; summary: string; content?: string },
    options: {
      maxTags?: number;
      includeRareKeywords?: boolean;
      filterCommonTags?: boolean;
      customContext?: string;
      language?: 'ja' | 'en' | 'mixed';
    } = {}
  ): Promise<string[]> {
    const tagSuggestions = await this.generateTagsDetailed(content, options);
    return tagSuggestions.tags.map((tag) => tag.name);
  }

  /**
   * 詳細なタグ生成（関連性スコア付き）
   */
  async generateTagsDetailed(
    content: RawContentData | { title: string; summary: string; content?: string },
    options: {
      maxTags?: number;
      includeRareKeywords?: boolean;
      filterCommonTags?: boolean;
      customContext?: string;
      language?: 'ja' | 'en' | 'mixed';
    } = {}
  ): Promise<TagSuggestions> {
    const {
      maxTags = 8,
      includeRareKeywords = false,
      filterCommonTags = true,
      language = 'mixed',
    } = options;

    const cacheKey = this.getCacheKey(content, options);

    // キャッシュチェック
    const cached = this.tagCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.info('Using cached tags', {
        title: content.title.slice(0, 50),
        tagsCount: cached.tags.tags.length,
      });
      return cached.tags;
    }

    try {
      const variables = {
        title: content.title,
        summary: content.summary,
        content: content.summary,
        maxTags: maxTags.toString(),
      };

      const response = await aiClient.chatCompletionJSON<{
        tags: Array<{
          name: string;
          relevance: number;
          type: 'technology' | 'topic' | 'difficulty' | 'content-type';
        }>;
        reasoning: string;
      }>(
        [
          {
            role: 'user',
            content: promptManager.renderTemplate('tag-generation', variables),
          },
        ],
        {
          description: 'Tag generation for content',
          properties: {
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  relevance: { type: 'number', minimum: 0, maximum: 1 },
                  type: {
                    type: 'string',
                    enum: ['technology', 'topic', 'difficulty', 'content-type'],
                  },
                },
              },
            },
            reasoning: { type: 'string' },
          },
        },
        {
          model: 'gpt-4o-mini',
          temperature: 0.4,
          maxTokens: 800,
        }
      );

      // タグの後処理・フィルタリング
      let processedTags = this.processGeneratedTags(response.tags, content, options);

      // 追加のキーワード抽出
      if (includeRareKeywords) {
        const extractedTags = this.extractKeywordTags(content, language);
        processedTags = this.mergeTags(processedTags, extractedTags);
      }

      // 最終フィルタリング
      if (filterCommonTags) {
        processedTags = this.filterCommonTags(processedTags);
      }

      // 最大数に制限
      processedTags = processedTags.sort((a, b) => b.relevance - a.relevance).slice(0, maxTags);

      const tagSuggestions: TagSuggestions = {
        tags: processedTags,
        reasoning: response.reasoning,
      };

      // タグ頻度を更新
      this.updateTagFrequency(processedTags.map((t) => t.name));

      // キャッシュに保存
      this.tagCache.set(cacheKey, {
        tags: tagSuggestions,
        timestamp: Date.now(),
      });

      this.logger.info('Tags generated', {
        title: content.title.slice(0, 50),
        tagsGenerated: processedTags.length,
        topTags: processedTags.slice(0, 3).map((t) => t.name),
      });

      return tagSuggestions;
    } catch (error) {
      this.logger.error('Tag generation failed', error as Error, {
        title: content.title.slice(0, 50),
      });

      // フォールバック: キーワード抽出
      return this.getFallbackTags(content, maxTags);
    }
  }

  /**
   * バッチタグ生成
   */
  async generateTagsBatch(
    contents: Array<RawContentData | { title: string; summary: string; content?: string }>,
    options: {
      maxTags?: number;
      maxConcurrent?: number;
      includeRareKeywords?: boolean;
    } = {}
  ): Promise<Map<string, string[]>> {
    const { maxConcurrent = 5 } = options;
    const results = new Map<string, string[]>();

    for (let i = 0; i < contents.length; i += maxConcurrent) {
      const batch = contents.slice(i, i + maxConcurrent);

      const promises = batch.map(async (content) => {
        try {
          const tags = await this.generateTags(content, options);
          return { content, tags };
        } catch (error) {
          this.logger.warn('Batch tag generation failed for item', {
            error: error as Error,
            title: content.title.slice(0, 50),
          });
          return {
            content,
            tags: this.getFallbackTags(content, options.maxTags || 8).tags.map((t) => t.name),
          };
        }
      });

      const batchResults = await Promise.all(promises);
      batchResults.forEach((result) => {
        const key = this.getContentKey(result.content);
        results.set(key, result.tags);
      });

      // レート制限対策
      if (i + maxConcurrent < contents.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.info('Batch tag generation completed', {
      totalContents: contents.length,
      processedContents: results.size,
    });

    return results;
  }

  /**
   * タグトレンド分析
   */
  async analyzeTagTrends(
    contents: Array<RawContentData | { title: string; summary: string; content?: string }>,
    timeWindow: '1week' | '1month' | '3months' = '1month'
  ): Promise<{
    trendingTags: Array<{ tag: string; frequency: number; growth: number }>;
    decliningTags: Array<{ tag: string; frequency: number; decline: number }>;
    emergingTags: Array<{ tag: string; frequency: number }>;
    recommendations: string[];
  }> {
    // 時系列でタグを分析
    const timeGroups = this.groupContentsByTime(contents, timeWindow);
    const tagsByPeriod = new Map<string, Map<string, number>>();

    for (const [period, periodContents] of timeGroups) {
      const tagCounts = new Map<string, number>();

      for (const content of periodContents) {
        const tags = await this.generateTags(content, { maxTags: 10 });
        tags.forEach((tag) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      }

      tagsByPeriod.set(period, tagCounts);
    }

    // トレンド計算
    const trendAnalysis = this.calculateTagTrends(tagsByPeriod);

    return trendAnalysis;
  }

  /**
   * タグクラスタリング（類似タグのグループ化）
   */
  async clusterTags(
    tags: string[],
    options: {
      maxClusters?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<{
    clusters: Array<{
      representative: string;
      members: string[];
      similarity: number;
    }>;
    suggestions: Array<{
      action: 'merge' | 'rename' | 'split';
      tags: string[];
      reason: string;
    }>;
  }> {
    const { maxClusters = 10, minSimilarity = 0.7 } = options;

    // タグの類似度行列を計算
    const similarityMatrix = await this.calculateTagSimilarity(tags);

    // クラスタリング実行
    const clusters = this.performClustering(tags, similarityMatrix, minSimilarity, maxClusters);

    // 改善提案生成
    const suggestions = this.generateClusteringSuggestions(clusters);

    return { clusters, suggestions };
  }

  /**
   * タグ正規化（表記揺れの統一）
   */
  normalizeTag(tag: string): string {
    // 小文字化
    let normalized = tag.toLowerCase();

    // 一般的な表記揺れの統一
    const normalizations: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      ml: 'machine learning',
      ai: 'artificial intelligence',
      api: 'API',
      ui: 'UI',
      ux: 'UX',
      css: 'CSS',
      html: 'HTML',
      sql: 'SQL',
      db: 'database',
      devops: 'DevOps',
    };

    // 正規化マップから検索
    for (const [from, to] of Object.entries(normalizations)) {
      if (normalized === from) {
        return to;
      }
    }

    // ハイフンとアンダースコアの統一
    normalized = normalized.replace(/_/g, '-');

    // 前後の空白削除
    normalized = normalized.trim();

    return normalized;
  }

  /**
   * プライベートメソッド群
   */
  private initializeCommonTags(): void {
    const common = [
      'javascript',
      'typescript',
      'react',
      'vue',
      'angular',
      'node.js',
      'python',
      'java',
      'css',
      'html',
      'api',
      'database',
      'web',
      'frontend',
      'backend',
      'tutorial',
      'guide',
      'tips',
      'beginner',
      'intermediate',
      'advanced',
      'best practices',
      'programming',
    ];

    common.forEach((tag) => this.commonTags.add(tag));
  }

  private getCacheKey(
    content: RawContentData | { title: string; summary: string; content?: string },
    options: any
  ): string {
    const contentKey = `${content.title}:${content.summary.slice(0, 100)}`;
    const optionsKey = JSON.stringify(options);
    return `${contentKey}:${optionsKey}`;
  }

  private getContentKey(
    content: RawContentData | { title: string; summary: string; content?: string }
  ): string {
    return `${content.title}:${content.summary.slice(0, 50)}`;
  }

  private processGeneratedTags(
    generatedTags: Array<{ name: string; relevance: number; type: string }>,
    _content: any,
    _options: any
  ): Tag[] {
    return generatedTags
      .map((tag) => ({
        ...tag,
        name: this.normalizeTag(tag.name),
        relevance: Math.max(0, Math.min(1, tag.relevance)),
        type: tag.type as TagType,
      }))
      .filter((tag) => tag.name.length > 1)
      .filter((tag, index, array) => array.findIndex((t) => t.name === tag.name) === index);
  }

  private extractKeywordTags(
    content: RawContentData | { title: string; summary: string; content?: string },
    _language: string
  ): Tag[] {
    const text = `${content.title} ${content.summary}`.toLowerCase();

    // 技術キーワードの抽出
    const techKeywords = [
      'react',
      'vue',
      'angular',
      'svelte',
      'typescript',
      'javascript',
      'python',
      'java',
      'go',
      'rust',
      'kotlin',
      'swift',
      'docker',
      'kubernetes',
      'aws',
      'azure',
      'gcp',
      'graphql',
      'rest',
      'api',
      'microservices',
      'serverless',
      'mongodb',
      'postgresql',
      'mysql',
      'redis',
      'elasticsearch',
    ];

    const extractedTags: Tag[] = [];

    techKeywords.forEach((keyword) => {
      if (text.includes(keyword)) {
        const frequency = (text.match(new RegExp(keyword, 'g')) || []).length;
        const relevance = Math.min(1, frequency * 0.3);

        extractedTags.push({
          name: keyword,
          relevance,
          type: 'technology',
        });
      }
    });

    return extractedTags;
  }

  private mergeTags(aiTags: Tag[], extractedTags: Tag[]): Tag[] {
    const tagMap = new Map<string, Tag>();

    // AIタグを優先
    aiTags.forEach((tag) => {
      tagMap.set(tag.name, tag);
    });

    // 抽出タグを追加（既存がない場合のみ）
    extractedTags.forEach((tag) => {
      if (!tagMap.has(tag.name)) {
        tagMap.set(tag.name, { ...tag, relevance: tag.relevance * 0.8 }); // 重みを少し下げる
      }
    });

    return Array.from(tagMap.values());
  }

  private filterCommonTags(tags: Tag[]): Tag[] {
    return tags.filter(
      (tag) => !this.commonTags.has(tag.name) || tag.relevance > 0.7 // 高関連性の場合は残す
    );
  }

  private updateTagFrequency(tags: string[]): void {
    tags.forEach((tag) => {
      this.tagFrequency.set(tag, (this.tagFrequency.get(tag) || 0) + 1);
    });
  }

  private getFallbackTags(
    content: RawContentData | { title: string; summary: string; content?: string },
    maxTags: number
  ): TagSuggestions {
    const extractedTags = this.extractKeywordTags(content, 'mixed');

    return {
      tags: extractedTags.slice(0, maxTags),
      reasoning: 'キーワード抽出によるフォールバック生成',
    };
  }

  private groupContentsByTime(
    contents: Array<RawContentData | { title: string; summary: string; content?: string }>,
    timeWindow: string
  ): Map<string, Array<RawContentData | { title: string; summary: string; content?: string }>> {
    const groups = new Map();

    contents.forEach((content) => {
      let period: string;

      if ('publishedAt' in content) {
        const date = new Date(content.publishedAt);
        switch (timeWindow) {
          case '1week':
            period = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;
            break;
          case '1month':
            period = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            break;
          case '3months':
            period = `${date.getFullYear()}-Q${Math.ceil((date.getMonth() + 1) / 3)}`;
            break;
          default:
            period = date.toISOString().split('T')[0];
        }
      } else {
        period = 'unknown';
      }

      if (!groups.has(period)) {
        groups.set(period, []);
      }
      groups.get(period).push(content);
    });

    return groups;
  }

  private calculateTagTrends(tagsByPeriod: Map<string, Map<string, number>>): any {
    // 簡略化したトレンド計算
    const allTags = new Set<string>();
    tagsByPeriod.forEach((periodTags) => {
      periodTags.forEach((_, tag) => allTags.add(tag));
    });

    const trendingTags: Array<{ tag: string; frequency: number; growth: number }> = [];
    const decliningTags: Array<{ tag: string; frequency: number; decline: number }> = [];
    const emergingTags: Array<{ tag: string; frequency: number }> = [];

    // 実装を簡略化
    return {
      trendingTags: trendingTags.slice(0, 10),
      decliningTags: decliningTags.slice(0, 10),
      emergingTags: emergingTags.slice(0, 10),
      recommendations: [
        'タグトレンド分析は実装中です',
        'より詳細な分析は今後のアップデートで提供予定です',
      ],
    };
  }

  private async calculateTagSimilarity(tags: string[]): Promise<number[][]> {
    // 簡易的な類似度計算（実際はより高度なアルゴリズムを使用）
    const matrix: number[][] = [];

    for (let i = 0; i < tags.length; i++) {
      matrix[i] = [];
      for (let j = 0; j < tags.length; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          // 簡易的な文字列類似度
          matrix[i][j] = this.calculateStringSimilarity(tags[i], tags[j]);
        }
      }
    }

    return matrix;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private performClustering(
    tags: string[],
    similarityMatrix: number[][],
    minSimilarity: number,
    maxClusters: number
  ): Array<{
    representative: string;
    members: string[];
    similarity: number;
  }> {
    // 簡易的なクラスタリング実装
    const clusters = [];
    const used = new Set<number>();

    for (let i = 0; i < tags.length && clusters.length < maxClusters; i++) {
      if (used.has(i)) continue;

      const cluster = {
        representative: tags[i],
        members: [tags[i]],
        similarity: 1.0,
      };

      for (let j = i + 1; j < tags.length; j++) {
        if (used.has(j)) continue;

        if (similarityMatrix[i][j] >= minSimilarity) {
          cluster.members.push(tags[j]);
          used.add(j);
        }
      }

      clusters.push(cluster);
      used.add(i);
    }

    return clusters;
  }

  private generateClusteringSuggestions(
    clusters: Array<{
      representative: string;
      members: string[];
      similarity: number;
    }>
  ): Array<{
    action: 'merge' | 'rename' | 'split';
    tags: string[];
    reason: string;
  }> {
    const suggestions: Array<{
      action: 'merge' | 'rename' | 'split';
      tags: string[];
      reason: string;
    }> = [];

    // 大きなクラスターの統合提案
    clusters.forEach((cluster) => {
      if (cluster.members.length > 3) {
        suggestions.push({
          action: 'merge' as const,
          tags: cluster.members,
          reason: `類似タグが多数あります。「${cluster.representative}」に統一することを検討してください。`,
        });
      }
    });

    return suggestions;
  }
}
