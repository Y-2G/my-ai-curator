import { openAIService } from './openai-service';

export interface UserInterestProfile {
  id: string;
  name: string;
  email: string;
  profile?: {
    techLevel?: 'beginner' | 'intermediate' | 'advanced';
    preferredStyle?: 'technical' | 'casual' | 'balanced';
    bio?: string;
    company?: string;
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

export class SearchQueryGenerator {
  
  /**
   * ユーザーの興味プロファイルから検索クエリを生成
   */
  async generateSearchQueries(
    userProfile: UserInterestProfile,
    options: {
      count?: number;
      includeLatestTrends?: boolean;
      focusAreas?: string[];
    } = {}
  ): Promise<SearchQuery[]> {
    const {
      count = 5,
      includeLatestTrends = true,
      focusAreas = [],
    } = options;

    // Processing user profile for search query generation

    try {
      const prompt = this.buildSearchQueryPrompt(userProfile, {
        count,
        includeLatestTrends,
        focusAreas,
      });

      const response = await openAIService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは技術情報収集の専門家です。ユーザーの興味に基づいて最適な検索クエリを生成してください。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      return this.validateAndFormatQueries(result.queries || []);

    } catch (error) {
      console.error('Search query generation error:', error);
      // フォールバック：基本的なクエリを生成
      return this.generateFallbackQueries(userProfile, count);
    }
  }

  /**
   * トレンドと組み合わせた検索クエリを生成
   */
  async generateTrendAwareQueries(
    userProfile: UserInterestProfile,
    currentTrends: string[] = []
  ): Promise<SearchQuery[]> {
    try {
      const prompt = `
ユーザープロファイル:
${this.formatUserProfile(userProfile)}

現在のトレンド:
${currentTrends.join(', ')}

上記の情報を基に、ユーザーの興味とトレンドを組み合わせた検索クエリを3-5個生成してください。

以下のJSON形式で回答してください:
{
  "queries": [
    {
      "query": "具体的な検索クエリ",
      "category": "カテゴリ名",
      "priority": 1-10の数値,
      "reasoning": "このクエリを選んだ理由",
      "sources": ["推奨する情報源のリスト"]
    }
  ]
}
`;

      const response = await openAIService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは技術トレンド分析の専門家です。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      return this.validateAndFormatQueries(result.queries || []);

    } catch (error) {
      console.error('Trend-aware query generation error:', error);
      return this.generateFallbackQueries(userProfile, 3);
    }
  }

  /**
   * 特定の分野に焦点を当てた検索クエリを生成
   */
  async generateFocusedQueries(
    userProfile: UserInterestProfile,
    focusArea: string,
    depth: 'surface' | 'intermediate' | 'deep' = 'intermediate'
  ): Promise<SearchQuery[]> {
    try {
      const prompt = `
ユーザープロファイル:
${this.formatUserProfile(userProfile)}

焦点分野: ${focusArea}
探索深度: ${depth}

上記の焦点分野について、ユーザーの技術レベル（${userProfile.profile?.techLevel || 'intermediate'}）に適した検索クエリを生成してください。

探索深度の定義:
- surface: 概要や基本情報
- intermediate: 実用的な情報や事例
- deep: 技術的詳細や最新研究

以下のJSON形式で回答してください:
{
  "queries": [
    {
      "query": "具体的な検索クエリ",
      "category": "${focusArea}",
      "priority": 1-10の数値,
      "reasoning": "このクエリを選んだ理由",
      "sources": ["推奨する情報源のリスト"]
    }
  ]
}
`;

      const response = await openAIService.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたは技術分野の専門知識を持つ情報収集アナリストです。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      return this.validateAndFormatQueries(result.queries || []);

    } catch (error) {
      console.error('Focused query generation error:', error);
      return this.generateFallbackQueries(userProfile, 3);
    }
  }

  /**
   * 検索クエリ生成用のプロンプトを構築
   */
  private buildSearchQueryPrompt(
    userProfile: UserInterestProfile,
    options: {
      count: number;
      includeLatestTrends: boolean;
      focusAreas: string[];
    }
  ): string {
    const userInfo = this.formatUserProfile(userProfile);
    
    return `
${userInfo}

タスク: 上記のユーザープロファイルに基づいて、${options.count}個の検索クエリを生成してください。

要件:
1. ユーザーの技術レベル（${userProfile.profile?.techLevel || 'intermediate'}）に適した内容
2. ユーザーの興味分野を考慮
3. ${options.includeLatestTrends ? '最新のトレンドや技術を含める' : '確立された技術に焦点'}
4. 実用的で具体的なクエリ
5. 多様性のある検索内容

${options.focusAreas.length > 0 ? `
特に以下の分野に重点を置いてください:
${options.focusAreas.join(', ')}
` : ''}

以下のJSON形式で回答してください:
{
  "queries": [
    {
      "query": "具体的な検索クエリ（日本語または英語）",
      "category": "カテゴリ名",
      "priority": 1-10の数値（高いほど重要）,
      "reasoning": "このクエリを選んだ理由",
      "sources": ["GitHub", "Stack Overflow", "Qiita", "Zenn", "公式ドキュメント", "技術ブログ"]
    }
  ]
}

検索クエリの例:
- "React Server Components 実装方法 2024"
- "TypeScript 5.0 新機能 実用例"
- "Next.js 14 App Router パフォーマンス最適化"
`;
  }

  /**
   * ユーザープロファイルを文字列形式に変換
   */
  private formatUserProfile(userProfile: UserInterestProfile): string {
    const profile = userProfile.profile || {};
    const interests = userProfile.interests || {};
    const userInterests = userProfile.userInterests || [];

    return `
ユーザープロファイル:
- 名前: ${userProfile.name}
- 技術レベル: ${profile.techLevel || 'intermediate'}
- 記事スタイル: ${profile.preferredStyle || 'balanced'}
- 自己紹介: ${profile.bio || '記載なし'}
- 会社: ${profile.company || '記載なし'}

興味分野:
- カテゴリ: ${interests.categories?.join(', ') || 'なし'}
- タグ: ${interests.tags?.join(', ') || 'なし'}
- キーワード: ${interests.keywords?.join(', ') || 'なし'}

重要度順キーワード:
${userInterests
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 10)
  .map(ui => `- ${ui.keyword} (重要度: ${ui.weight})`)
  .join('\n')}
`;
  }

  /**
   * 生成されたクエリを検証・整形
   */
  private validateAndFormatQueries(queries: any[]): SearchQuery[] {
    return queries
      .filter((q) => q.query && q.category)
      .map((q) => ({
        query: q.query,
        category: q.category,
        priority: Math.max(1, Math.min(10, q.priority || 5)),
        reasoning: q.reasoning || 'AI generated query',
        sources: Array.isArray(q.sources) ? q.sources : ['Web Search'],
      }))
      .slice(0, 10); // 最大10個まで
  }

  /**
   * フォールバック用の基本クエリ生成
   */
  private generateFallbackQueries(
    userProfile: UserInterestProfile,
    count: number
  ): SearchQuery[] {
    const interests = userProfile.interests || {};
    const userInterests = userProfile.userInterests || [];
    
    const fallbackQueries: SearchQuery[] = [];

    // カテゴリベースのクエリ
    if (interests.categories) {
      interests.categories.forEach((category) => {
        fallbackQueries.push({
          query: `${category} 最新情報 2024`,
          category,
          priority: 7,
          reasoning: `ユーザーの興味カテゴリ: ${category}`,
          sources: ['Web Search', 'GitHub', 'Qiita'],
        });
      });
    }

    // キーワードベースのクエリ
    userInterests
      .sort((a, b) => b.weight - a.weight)
      .slice(0, count)
      .forEach((ui) => {
        fallbackQueries.push({
          query: `${ui.keyword} 最新 チュートリアル`,
          category: interests.categories?.[0] || 'プログラミング',
          priority: Math.round(ui.weight * 10),
          reasoning: `重要度の高いキーワード: ${ui.keyword}`,
          sources: ['Web Search', 'Stack Overflow'],
        });
      });

    return fallbackQueries.slice(0, count);
  }
}

export const searchQueryGenerator = new SearchQueryGenerator();