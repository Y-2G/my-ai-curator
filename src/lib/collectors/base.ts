import type { RawContentData } from '@/lib/ai/types';
import { Logger } from '@/lib/utils/logger';
import { RateLimiter } from '@/lib/utils/rate-limiter';

export abstract class BaseCollector {
  protected logger: Logger;
  protected rateLimiter: RateLimiter;
  protected name: string;
  
  constructor(name: string) {
    this.name = name;
    this.logger = new Logger(`Collector:${name}`);
    this.rateLimiter = new RateLimiter();
  }

  abstract collect(query: string, limit: number): Promise<RawContentData[]>;

  async isRateLimited(): Promise<boolean> {
    return this.rateLimiter.isLimited(`collector:${this.name}`);
  }

  async getNextAvailableTime(): Promise<Date | null> {
    return this.rateLimiter.getNextAvailableTime(`collector:${this.name}`);
  }

  protected async trackApiCall(): Promise<void> {
    await this.rateLimiter.track(`collector:${this.name}`);
  }

  protected transformToRawContent(_data: any): RawContentData {
    // 各収集サービスでオーバーライド
    throw new Error('transformToRawContent must be implemented');
  }

  // 共通のエラーハンドリング
  protected async handleError(error: any, context: string): Promise<RawContentData[]> {
    this.logger.error(`Error in ${context}`, error, {
      collector: this.name,
      message: error.message,
    });
    return [];
  }

  // URLの重複チェック
  protected removeDuplicates(items: RawContentData[]): RawContentData[] {
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.url)) {
        return false;
      }
      seen.add(item.url);
      return true;
    });
  }
}