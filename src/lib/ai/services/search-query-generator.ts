import { openai } from '../openai';
import { UserProfile, SearchQuery } from '../types';
import { formatUserProfile } from '../utiles';

export class SearchQueryGenerator {
  /**
   * ユーザーの興味プロファイルから検索クエリを生成
   */
  async generateSearchQueries(
    userProfile: UserProfile,
    options: {
      count?: number;
      focusAreas?: string[];
    } = {}
  ): Promise<SearchQuery[]> {
    const { count = 10, focusAreas = [] } = options;

    // Processing user profile for search query generation
    try {
      const prompt = this.buildSearchQueryPrompt(userProfile, {
        count,
        focusAreas,
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'あなたは情報収集の専門家です。ユーザーの興味に基づいて最適な検索クエリを生成してください。',
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
      return [];
    }
  }

  /**
   * 検索クエリ生成用のプロンプトを構築
   */
  private buildSearchQueryPrompt(
    userProfile: UserProfile,
    options: {
      count: number;
      focusAreas: string[];
    }
  ): string {
    const userInfo = formatUserProfile(userProfile);

    return `
${userInfo}

タスク: 上記のユーザープロファイルに基づいて、${options.count}個の検索クエリを生成してください。

要件:
- ユーザーの興味分野を考慮
- 実用的で具体的なクエリ
- 多様性のある検索内容

!!重要!!
- 年代や日付などの情報をクエリに含めない

以下のJSON形式で回答してください:
{
  "queries": [
    {
      "query": "具体的な検索クエリ（日本語または英語）",
      "category": "カテゴリ名",
      "priority": 1-10の数値（高いほど重要）,
      "reasoning": "このクエリを選んだ理由",
    }
  ]
}

検索クエリの例:
- "React Server Components 実装方法"
- "TypeScript 5.0 新機能 実用例"
- "Next.js 14 App Router パフォーマンス最適化"
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
}

export const searchQueryGenerator = new SearchQueryGenerator();
