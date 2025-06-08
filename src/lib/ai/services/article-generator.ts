import aiClient from '../client';
import promptManager from '../prompts';
import type { GeneratedArticle, UserProfile } from '../types';
import type { RawContentData } from '@/lib/types';
import { Logger } from '@/lib/utils/logger';

export class ArticleGenerator {
  private logger: Logger;
  private generationCache: Map<string, { article: GeneratedArticle; timestamp: number }>;
  private readonly CACHE_TTL = 60 * 60 * 1000; // 1時間

  constructor() {
    this.logger = new Logger('ArticleGenerator');
    this.generationCache = new Map();
  }

  /**
   * 複数のソースから統合記事を生成
   */
  async generate(
    sources: RawContentData[],
    userProfile: UserProfile,
    options: {
      targetLength?: 'short' | 'medium' | 'long';
      style?: 'tutorial' | 'news' | 'analysis' | 'review';
      includeCodeExamples?: boolean;
      language?: 'ja' | 'en';
    } = {}
  ): Promise<GeneratedArticle> {
    const {
      targetLength = 'medium',
      style = 'tutorial',
      includeCodeExamples = true,
      language = 'ja',
    } = options;

    const cacheKey = this.getCacheKey(sources, userProfile, options);
    
    // キャッシュチェック
    const cached = this.generationCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.info('Using cached article generation', { 
        cacheKey: cacheKey.slice(0, 50),
        title: cached.article.title.slice(0, 50),
      });
      return cached.article;
    }

    try {
      this.logger.info('Starting article generation', {
        sourcesCount: sources.length,
        targetLength,
        style,
        userId: userProfile.id,
      });

      const article = await this.generateInternal(sources, userProfile, {
        targetLength,
        style,
        includeCodeExamples,
        language,
      });

      // キャッシュに保存
      this.generationCache.set(cacheKey, {
        article,
        timestamp: Date.now(),
      });

      this.logger.info('Article generation completed', {
        title: article.title,
        wordCount: article.metadata.wordCount,
        confidence: article.confidence,
        sourcesUsed: article.sources.length,
      });

      return article;

    } catch (error) {
      this.logger.error('Article generation failed', error as Error, {
        sourcesCount: sources.length,
        userId: userProfile.id,
      });
      throw error;
    }
  }

  /**
   * 内部記事生成ロジック
   */
  private async generateInternal(
    sources: RawContentData[],
    userProfile: UserProfile,
    options: any
  ): Promise<GeneratedArticle> {
    // 1. ソースを前処理・優先度付け
    const processedSources = this.preprocessSources(sources, userProfile);
    
    // 2. 記事生成用プロンプト変数を準備
    const variables = {
      sources: this.formatSourcesForPrompt(processedSources),
      userProfile: this.formatUserProfileForPrompt(userProfile),
      targetLength: this.getTargetWordCount(options.targetLength),
      style: options.style,
    };

    // 3. AIで記事生成
    const response = await aiClient.chatCompletionJSON<{
      title: string;
      summary: string;
      content: string;
      category: string;
      tags: string[];
      sources: Array<{
        url: string;
        title: string;
        relevance: number;
      }>;
      confidence: number;
      metadata: {
        wordCount: number;
        readingTime: number;
        difficulty: 'beginner' | 'intermediate' | 'advanced';
        contentType: 'tutorial' | 'news' | 'analysis' | 'review';
      };
    }>(
      [
        {
          role: 'user',
          content: promptManager.renderTemplate('article-generation', variables)
        }
      ],
      {
        description: 'Generated article content',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          content: { type: 'string' },
          category: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          sources: { type: 'array' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          metadata: { type: 'object' }
        }
      },
      {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 3000,
      }
    );

    // 4. 後処理・検証
    const processedArticle = this.postProcessArticle(response, processedSources, options);
    
    return processedArticle;
  }

  /**
   * ソースの前処理と優先度付け
   */
  private preprocessSources(
    sources: RawContentData[],
    userProfile: UserProfile
  ): Array<RawContentData & { priority: number; relevanceScore: number }> {
    return sources
      .map(source => ({
        ...source,
        priority: this.calculateSourcePriority(source, userProfile),
        relevanceScore: this.calculateRelevance(source, userProfile),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 5); // 最大5つのソースに制限
  }

  /**
   * ソース優先度計算
   */
  private calculateSourcePriority(source: RawContentData, userProfile: UserProfile): number {
    let priority = 5; // ベース優先度

    // 新しさによる加点
    const hoursOld = (Date.now() - new Date(source.publishedAt).getTime()) / (1000 * 60 * 60);
    if (hoursOld < 24) priority += 2;
    else if (hoursOld < 168) priority += 1; // 1週間以内
    else if (hoursOld > 2160) priority -= 1; // 3ヶ月以上古い

    // ソースタイプによる加点
    const sourceBonus = {
      'github': 1.5,
      'news': 1.2,
      'rss': 1.0,
      'reddit': 0.8,
    }[source.source] || 1.0;
    priority *= sourceBonus;

    // ユーザー興味との関連性
    const contentText = (source.title + ' ' + source.summary).toLowerCase();
    const matchedInterests = userProfile.interests.filter(interest =>
      contentText.includes(interest.toLowerCase())
    );
    priority += matchedInterests.length * 0.5;

    return Math.max(1, Math.min(10, priority));
  }

  /**
   * ソース関連性計算
   */
  private calculateRelevance(source: RawContentData, userProfile: UserProfile): number {
    const contentText = (source.title + ' ' + source.summary).toLowerCase();
    const userInterests = userProfile.interests.map(i => i.toLowerCase());
    
    let relevance = 0;
    userInterests.forEach(interest => {
      if (contentText.includes(interest)) {
        relevance += 1;
      }
    });

    return Math.min(1, relevance / userInterests.length);
  }

  /**
   * バッチ記事生成
   */
  async generateBatch(
    sourceGroups: RawContentData[][],
    userProfile: UserProfile,
    options: any = {}
  ): Promise<Array<{ success: boolean; article?: GeneratedArticle; error?: string }>> {
    const results = [];

    for (let i = 0; i < sourceGroups.length; i++) {
      try {
        this.logger.info(`Generating article ${i + 1}/${sourceGroups.length}`);
        
        const article = await this.generate(sourceGroups[i], userProfile, options);
        results.push({ success: true, article });

        // レート制限対策で待機
        if (i < sourceGroups.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        this.logger.error(`Batch generation failed for group ${i + 1}`, error as Error);
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * 記事の更新・改善
   */
  async improveArticle(
    existingArticle: GeneratedArticle,
    feedback: {
      improveAreas: ('clarity' | 'depth' | 'examples' | 'structure')[];
      userComments?: string;
      additionalSources?: RawContentData[];
    },
    _userProfile: UserProfile
  ): Promise<GeneratedArticle> {
    const improvementPrompt = this.buildImprovementPrompt(existingArticle, feedback);

    try {
      const response = await aiClient.chatCompletionJSON<GeneratedArticle>(
        [
          {
            role: 'user',
            content: improvementPrompt
          }
        ],
        {
          description: 'Improved article content',
          properties: {
            title: { type: 'string' },
            summary: { type: 'string' },
            content: { type: 'string' },
            category: { type: 'string' },
            tags: { type: 'array' },
            sources: { type: 'array' },
            confidence: { type: 'number' },
            metadata: { type: 'object' }
          }
        },
        {
          model: 'gpt-4o',
          temperature: 0.6,
          maxTokens: 3500,
        }
      );

      this.logger.info('Article improvement completed', {
        originalTitle: existingArticle.title,
        improvedTitle: response.title,
        improvementAreas: feedback.improveAreas,
      });

      return response;

    } catch (error) {
      this.logger.error('Article improvement failed', error as Error);
      throw error;
    }
  }

  /**
   * プライベートメソッド群
   */
  private getCacheKey(
    sources: RawContentData[],
    userProfile: UserProfile,
    options: any
  ): string {
    const sourceUrls = sources.map(s => s.url).sort().join('|');
    const optionsStr = JSON.stringify(options);
    return `${userProfile.id}:${sourceUrls}:${optionsStr}`;
  }

  private formatSourcesForPrompt(sources: Array<RawContentData & { priority: number }>): string {
    return sources
      .map((source, index) => 
        `${index + 1}. **${source.title}** (優先度: ${source.priority.toFixed(1)})\n` +
        `   URL: ${source.url}\n` +
        `   要約: ${source.summary}\n` +
        `   ソース: ${source.source}\n` +
        `   公開日: ${source.publishedAt}`
      )
      .join('\n\n');
  }

  private formatUserProfileForPrompt(userProfile: UserProfile): string {
    return `技術レベル: ${userProfile.techLevel}\n` +
           `興味分野: ${userProfile.interests.join(', ')}\n` +
           `好むコンテンツタイプ: ${userProfile.contentTypes.join(', ')}\n` +
           `言語設定: ${userProfile.languagePreference}`;
  }

  private getTargetWordCount(targetLength: string): string {
    switch (targetLength) {
      case 'short': return '800-1200';
      case 'medium': return '1500-2500';
      case 'long': return '3000-4000';
      default: return '1500-2500';
    }
  }

  private postProcessArticle(
    response: any,
    sources: Array<RawContentData & { priority: number }>,
    options: any
  ): GeneratedArticle {
    // コンテンツの検証・補正
    const wordCount = this.countWords(response.content);
    const readingTime = Math.ceil(wordCount / 200); // 1分200語で計算

    // ソース情報の補完
    const enhancedSources = response.sources.map((source: any) => ({
      url: source.url,
      title: source.title,
      type: this.findSourceType(source.url, sources),
      relevance: source.relevance || 0.5,
    }));

    return {
      title: response.title,
      summary: response.summary,
      content: response.content,
      category: response.category,
      tags: response.tags.slice(0, 8), // 最大8タグに制限
      sources: enhancedSources,
      confidence: Math.max(0.1, Math.min(1.0, response.confidence || 0.7)),
      metadata: {
        wordCount,
        readingTime,
        difficulty: response.metadata?.difficulty || this.inferDifficulty(response.content),
        contentType: response.metadata?.contentType || options.style || 'tutorial',
      },
    };
  }

  private countWords(text: string): number {
    // 日本語と英語のワードカウント
    const cleanText = text.replace(/[#*`\-\[\]()]/g, '').trim();
    const englishWords = cleanText.match(/[a-zA-Z]+/g)?.length || 0;
    const japaneseChars = cleanText.replace(/[a-zA-Z\s\d\p{P}]/gu, '').length;
    
    return englishWords + Math.ceil(japaneseChars / 2); // 日本語は2文字=1ワード換算
  }

  private findSourceType(url: string, sources: RawContentData[]): string {
    const source = sources.find(s => s.url === url);
    return source?.type || 'web';
  }

  private inferDifficulty(content: string): 'beginner' | 'intermediate' | 'advanced' {
    const text = content.toLowerCase();
    
    const beginnerKeywords = ['tutorial', 'beginner', 'intro', 'basic', '初心者', '入門'];
    const advancedKeywords = ['advanced', 'expert', 'optimization', 'architecture', 'deep', '上級', '最適化'];
    
    const beginnerCount = beginnerKeywords.filter(keyword => text.includes(keyword)).length;
    const advancedCount = advancedKeywords.filter(keyword => text.includes(keyword)).length;
    
    if (advancedCount > beginnerCount) return 'advanced';
    if (beginnerCount > 0) return 'beginner';
    return 'intermediate';
  }

  private buildImprovementPrompt(
    existingArticle: GeneratedArticle,
    feedback: any
  ): string {
    return `
以下の記事を改善してください。

# 既存記事
タイトル: ${existingArticle.title}
要約: ${existingArticle.summary}
本文: ${existingArticle.content}

# 改善要求
- 改善領域: ${feedback.improveAreas.join(', ')}
- ユーザーコメント: ${feedback.userComments || 'なし'}

# 改善指針
${feedback.improveAreas.includes('clarity') ? '- より明確で理解しやすい表現に修正' : ''}
${feedback.improveAreas.includes('depth') ? '- 内容をより深く詳細に解説' : ''}
${feedback.improveAreas.includes('examples') ? '- 具体例やコードサンプルを追加' : ''}
${feedback.improveAreas.includes('structure') ? '- 構造を整理し、読みやすく再構成' : ''}

改善された記事をJSON形式で出力してください。
`;
  }

  /**
   * 記事品質メトリクス
   */
  async calculateQualityMetrics(article: GeneratedArticle): Promise<{
    overallScore: number;
    metrics: {
      contentLength: number;
      titleQuality: number;
      structureScore: number;
      sourceCoverage: number;
      tagRelevance: number;
    };
    suggestions: string[];
  }> {
    const metrics = {
      contentLength: this.evaluateContentLength(article),
      titleQuality: this.evaluateTitleQuality(article.title),
      structureScore: this.evaluateStructure(article.content),
      sourceCoverage: this.evaluateSourceCoverage(article),
      tagRelevance: this.evaluateTagRelevance(article),
    };

    const overallScore = Object.values(metrics).reduce((sum, score) => sum + score, 0) / Object.keys(metrics).length;

    const suggestions = this.generateQualitySuggestions(metrics, article);

    return {
      overallScore: Math.round(overallScore * 10) / 10,
      metrics,
      suggestions,
    };
  }

  private evaluateContentLength(article: GeneratedArticle): number {
    const wordCount = article.metadata.wordCount;
    if (wordCount < 500) return 3;
    if (wordCount < 1000) return 6;
    if (wordCount < 2000) return 9;
    if (wordCount < 3000) return 10;
    return 8; // 長すぎる場合は少し減点
  }

  private evaluateTitleQuality(title: string): number {
    let score = 5;
    
    // 長さチェック
    if (title.length > 20 && title.length < 60) score += 2;
    
    // 具体性チェック
    const specificWords = ['方法', 'ガイド', '入門', '完全版', '実践', 'ベストプラクティス'];
    if (specificWords.some(word => title.includes(word))) score += 2;
    
    // 技術キーワードチェック
    const techWords = ['React', 'TypeScript', 'JavaScript', 'Python', 'AI', 'API'];
    if (techWords.some(word => title.includes(word))) score += 1;
    
    return Math.min(10, score);
  }

  private evaluateStructure(content: string): number {
    let score = 5;
    
    // 見出し構造
    const headings = content.match(/^#+\s/gm);
    if (headings && headings.length >= 3) score += 2;
    
    // リスト構造
    const lists = content.match(/^[\-\*]\s/gm);
    if (lists && lists.length >= 3) score += 1;
    
    // コードブロック
    const codeBlocks = content.match(/```[\s\S]*?```/g);
    if (codeBlocks && codeBlocks.length >= 1) score += 2;
    
    return Math.min(10, score);
  }

  private evaluateSourceCoverage(article: GeneratedArticle): number {
    const sourceCount = article.sources.length;
    if (sourceCount === 0) return 0;
    if (sourceCount === 1) return 4;
    if (sourceCount <= 3) return 8;
    return 10;
  }

  private evaluateTagRelevance(article: GeneratedArticle): number {
    const tagCount = article.tags.length;
    if (tagCount < 3) return 5;
    if (tagCount <= 6) return 10;
    return 8; // 多すぎる場合は減点
  }

  private generateQualitySuggestions(metrics: any, _article: GeneratedArticle): string[] {
    const suggestions: string[] = [];
    
    if (metrics.contentLength < 7) {
      suggestions.push('記事の内容をより詳しく展開することをお勧めします');
    }
    
    if (metrics.titleQuality < 7) {
      suggestions.push('タイトルをより具体的で魅力的にすることをお勧めします');
    }
    
    if (metrics.structureScore < 7) {
      suggestions.push('見出しやリストを使って構造を改善することをお勧めします');
    }
    
    if (metrics.sourceCoverage < 7) {
      suggestions.push('より多くの情報源を活用することをお勧めします');
    }
    
    if (metrics.tagRelevance < 7) {
      suggestions.push('記事内容により関連性の高いタグを設定することをお勧めします');
    }
    
    return suggestions;
  }
}