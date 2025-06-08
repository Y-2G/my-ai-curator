import OpenAI from 'openai';
import { z } from 'zod';
import PromptManager from './prompts';

// OpenAI クライアントの初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 記事生成のレスポンススキーマ
const GeneratedArticleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  category: z.string(),
  tags: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

// 興味度スコアのレスポンススキーマ
const InterestScoreSchema = z.object({
  score: z.number().min(0).max(10),
  reasoning: z.string(),
});

// カテゴリ分類のレスポンススキーマ
const CategoryClassificationSchema = z.object({
  category: z.string(),
  confidence: z.number().min(0).max(1),
});

export type GeneratedArticle = z.infer<typeof GeneratedArticleSchema>;
export type InterestScore = z.infer<typeof InterestScoreSchema>;
export type CategoryClassification = z.infer<typeof CategoryClassificationSchema>;

export interface UserProfile {
  techLevel: 'beginner' | 'intermediate' | 'advanced';
  interests: string[];
  preferredStyle: 'technical' | 'casual' | 'balanced';
}

export interface RawContentData {
  title: string;
  url: string;
  summary: string;
  publishedAt: Date;
  source: string;
  type: string;
}

export class OpenAIService {
  private model = 'gpt-4o-mini'; // コスト効率の良いモデル
  public openai = openai; // 外部からアクセス可能にする

  /**
   * 複数の情報源から記事を生成
   */
  async generateArticle(
    sources: RawContentData[],
    userProfile?: UserProfile
  ): Promise<GeneratedArticle> {
    const prompt = this.buildArticleGenerationPrompt(sources, userProfile);
    
    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたは技術系の個人ブログライターです。読者の興味を引く記事を作成してください。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(content);
      return GeneratedArticleSchema.parse(parsedResponse);
    } catch (error) {
      console.error('OpenAI article generation error:', error);
      throw new Error('Failed to generate article');
    }
  }

  /**
   * コンテンツの興味度スコアを計算
   */
  async calculateInterestScore(
    content: RawContentData,
    userProfile: UserProfile
  ): Promise<InterestScore> {
    const prompt = `
以下のコンテンツについて、ユーザーの興味度を0-10のスコアで評価してください。

ユーザープロフィール:
- 技術レベル: ${userProfile.techLevel}
- 興味分野: ${userProfile.interests.join(', ')}
- 好むスタイル: ${userProfile.preferredStyle}

コンテンツ:
- タイトル: ${content.title}
- 要約: ${content.summary}
- ソース: ${content.source}

以下のJSON形式で回答してください:
{
  "score": 数値（0-10）,
  "reasoning": "スコアの理由"
}
`;

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたはコンテンツ評価の専門家です。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(content);
      return InterestScoreSchema.parse(parsedResponse);
    } catch (error) {
      console.error('OpenAI interest score error:', error);
      // エラー時はデフォルト値を返す
      return {
        score: 5,
        reasoning: 'Could not calculate interest score',
      };
    }
  }

  /**
   * コンテンツのカテゴリを分類
   */
  async categorizeContent(
    content: string,
    availableCategories: string[]
  ): Promise<CategoryClassification> {
    const prompt = `
以下のコンテンツを、利用可能なカテゴリのいずれかに分類してください。

コンテンツ:
${content.substring(0, 1000)}...

利用可能なカテゴリ:
${availableCategories.join(', ')}

以下のJSON形式で回答してください:
{
  "category": "選択したカテゴリ名",
  "confidence": 信頼度（0-1）
}
`;

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたはコンテンツ分類の専門家です。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsedResponse = JSON.parse(content);
      return CategoryClassificationSchema.parse(parsedResponse);
    } catch (error) {
      console.error('OpenAI categorization error:', error);
      // エラー時はデフォルトカテゴリを返す
      return {
        category: availableCategories[0] || 'その他',
        confidence: 0.5,
      };
    }
  }

  /**
   * 検索クエリを生成
   */
  async generateSearchQueries(
    userProfile: UserProfile,
    limit: number = 5
  ): Promise<string[]> {
    const prompt = `
以下のユーザープロフィールに基づいて、技術系の検索クエリを${limit}個生成してください。

ユーザープロフィール:
- 技術レベル: ${userProfile.techLevel}
- 興味分野: ${userProfile.interests.join(', ')}
- 好むスタイル: ${userProfile.preferredStyle}

最新のトレンドや話題を考慮し、具体的で検索しやすいクエリを生成してください。
各クエリは1行ずつ記載してください。
`;

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたは技術トレンドに詳しい専門家です。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.8,
        max_tokens: 200,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return content
        .split('\n')
        .filter(query => query.trim().length > 0)
        .slice(0, limit);
    } catch (error) {
      console.error('OpenAI search query generation error:', error);
      // エラー時はデフォルトクエリを返す
      return userProfile.interests.slice(0, limit);
    }
  }

  /**
   * タグを生成
   */
  async generateTags(content: string, limit: number = 5): Promise<string[]> {
    const prompt = `
以下のコンテンツから、関連するタグを${limit}個抽出してください。

コンテンツ:
${content.substring(0, 1000)}...

タグは短く、具体的で、技術用語を含むものにしてください。
各タグは1行ずつ記載してください。
`;

    try {
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'あなたはコンテンツのタグ付け専門家です。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return content
        .split('\n')
        .filter(tag => tag.trim().length > 0)
        .slice(0, limit);
    } catch (error) {
      console.error('OpenAI tag generation error:', error);
      return [];
    }
  }

  /**
   * 記事生成用のプロンプトを構築
   */
  private buildArticleGenerationPrompt(
    sources: RawContentData[],
    userProfile?: UserProfile
  ): string {
    const sourcesSection = sources
      .map(
        (source, index) => `
## ソース ${index + 1}
- タイトル: ${source.title}
- URL: ${source.url}
- 要約: ${source.summary}
- 公開日: ${source.publishedAt.toISOString()}
- ソース: ${source.source}
`
      )
      .join('\n');

    const userProfileSection = userProfile
      ? `
# 読者プロフィール
- 技術レベル: ${userProfile.techLevel}
- 興味分野: ${userProfile.interests.join(', ')}
- 好む記事スタイル: ${userProfile.preferredStyle}
`
      : `
# 読者プロフィール
- 技術レベル: intermediate
- 興味分野: プログラミング, AI・機械学習
- 好む記事スタイル: balanced
`;

    // プロンプトマネージャーから「article-generation」テンプレートを使用
    return PromptManager.renderTemplate('article-generation', {
      sources: sourcesSection,
      userProfile: userProfileSection,
      targetLength: '600',
      style: userProfile?.preferredStyle || 'balanced',
    });
  }
}

export const openAIService = new OpenAIService();