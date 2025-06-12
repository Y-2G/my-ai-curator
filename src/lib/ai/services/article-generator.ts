import PromptManager from '../prompts';
import { CategoryClassification, GeneratedArticle, InterestScore } from '../types';
import {
  CategoryClassificationSchema,
  GeneratedArticleSchema,
  InterestScoreSchema,
} from '../schema';
import { model, openai } from '../openai';

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

export class ArticleGenerator {
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
        model: model,
        messages: [
          {
            role: 'system',
            content: 'あなたはプロのWebライターです。読者の興味を引く記事を作成してください。',
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
        model: model,
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
        model: model,
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

    const userProfileSection = `
# 読者プロフィール
- 興味分野: ${userProfile?.interests.join(', ')}
- 好む記事スタイル: ${userProfile?.preferredStyle}
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
