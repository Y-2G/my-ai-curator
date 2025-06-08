import { Logger } from './logger';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('RateLimiter');
  }

  async track(key: string): Promise<void> {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // 古いリクエストを削除
    const validRequests = requests.filter(time => now - time < 60000); // 1分以内
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    this.logger.debug(`Tracked request for ${key}. Count: ${validRequests.length}`);
  }

  async isLimited(key: string, config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }): Promise<boolean> {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // 期間内のリクエストをカウント
    const recentRequests = requests.filter(time => now - time < config.windowMs);
    
    if (recentRequests.length >= config.maxRequests) {
      this.logger.warn(`Rate limit exceeded for ${key}`, {
        current: recentRequests.length,
        max: config.maxRequests,
        window: config.windowMs
      });
      return true;
    }
    
    return false;
  }

  async getNextAvailableTime(key: string, config: RateLimitConfig = { maxRequests: 10, windowMs: 60000 }): Promise<Date | null> {
    const requests = this.requests.get(key) || [];
    
    if (requests.length < config.maxRequests) {
      return null; // すぐに利用可能
    }
    
    // 最も古いリクエストから計算
    const oldestRequest = Math.min(...requests);
    const nextAvailable = new Date(oldestRequest + config.windowMs);
    
    return nextAvailable;
  }

  // 定期的なクリーンアップ
  cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => now - time < 3600000); // 1時間以内
      
      if (validRequests.length === 0) {
        this.requests.delete(key);
        cleaned++;
      } else {
        this.requests.set(key, validRequests);
      }
    }
    
    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} rate limit entries`);
    }
  }
}