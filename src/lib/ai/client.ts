import OpenAI from 'openai';
import { Logger } from '@/lib/utils/logger';

class AIClient {
  private static instance: AIClient;
  private openai: OpenAI;
  private logger: Logger;

  private constructor() {
    this.logger = new Logger('AIClient');
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY environment variable is required');
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.openai = new OpenAI({
      apiKey,
      timeout: 30000, // 30秒タイムアウト
    });

    this.logger.info('OpenAI client initialized');
  }

  public static getInstance(): AIClient {
    if (!AIClient.instance) {
      AIClient.instance = new AIClient();
    }
    return AIClient.instance;
  }

  public getOpenAI(): OpenAI {
    return this.openai;
  }

  // 共通のチャット完了メソッド
  async chatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'text' | 'json';
      systemPrompt?: string;
    } = {}
  ): Promise<string> {
    const {
      model = 'gpt-4o-mini',
      temperature = 0.7,
      maxTokens = 2000,
      responseFormat = 'text',
      systemPrompt
    } = options;

    try {
      // システムプロンプトがある場合は先頭に追加
      const finalMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = 
        systemPrompt 
          ? [{ role: 'system', content: systemPrompt }, ...messages]
          : messages;

      const completion = await this.openai.chat.completions.create({
        model,
        messages: finalMessages,
        temperature,
        max_tokens: maxTokens,
        response_format: responseFormat === 'json' 
          ? { type: 'json_object' } 
          : { type: 'text' }
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content received from OpenAI');
      }

      this.logger.info('Chat completion successful', {
        model,
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens,
      });

      return content;

    } catch (error) {
      this.logger.error('Chat completion failed', error as Error, {
        model,
        messageCount: messages.length,
      });
      throw error;
    }
  }

  // JSONレスポンス用のヘルパーメソッド
  async chatCompletionJSON<T>(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    schema: {
      description: string;
      properties: Record<string, any>;
    },
    options: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    } = {}
  ): Promise<T> {
    const systemPrompt = options.systemPrompt || 
      `You are a helpful assistant that responds only in valid JSON format. 
       Please respond with JSON matching this schema: ${JSON.stringify(schema)}`;

    const content = await this.chatCompletion(messages, {
      ...options,
      responseFormat: 'json',
      systemPrompt,
    });

    try {
      return JSON.parse(content) as T;
    } catch (error) {
      this.logger.error('Failed to parse JSON response', error as Error, {
        content: content.slice(0, 200) + '...',
      });
      throw new Error('Invalid JSON response from AI');
    }
  }

  // API使用量とコスト追跡
  async getUsageStats(): Promise<{
    currentUsage: number;
    estimatedCost: number;
    lastReset: Date;
  }> {
    // 簡易的な使用量追跡（実際のプロダクションでは詳細な追跡が必要）
    return {
      currentUsage: 0,
      estimatedCost: 0,
      lastReset: new Date(),
    };
  }

  // ヘルスチェック
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.chatCompletion([
        { role: 'user', content: 'Hello, please respond with "OK"' }
      ], {
        model: 'gpt-4o-mini',
        maxTokens: 10,
        temperature: 0,
      });

      return response.trim().toLowerCase().includes('ok');
    } catch (error) {
      this.logger.error('Health check failed', error as Error);
      return false;
    }
  }
}

export { AIClient };

// デフォルトエクスポートでシングルトンインスタンスを提供
export default AIClient.getInstance();