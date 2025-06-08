import Parser from 'rss-parser';
import { BaseCollector } from './base';
import type { RawContentData } from '@/lib/types';
import { getActiveRSSSources } from '@/lib/config/rss-sources';

export class RssCollector extends BaseCollector {
  private parser: Parser;

  constructor() {
    super('RSS');
    this.parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'SmartCurator/1.0',
      },
    });
  }

  async collect(query: string, limit: number): Promise<RawContentData[]> {
    try {
      await this.trackApiCall();
      
      const allItems: RawContentData[] = [];
      
      // 複数のRSSフィードから収集
      const activeSources = getActiveRSSSources();
      for (const feedConfig of activeSources) {
        try {
          this.logger.info(`Fetching RSS feed: ${feedConfig.name}`);
          
          const feed = await this.parser.parseURL(feedConfig.url);
          
          // フィードアイテムを変換
          const items = feed.items
            .slice(0, Math.ceil(limit / activeSources.length))
            .map(item => this.transformFeedItem(item, feedConfig.name, query))
            .filter(item => this.matchesQuery(item, query));
          
          allItems.push(...items);
          
        } catch (error) {
          this.logger.error(`Failed to fetch ${feedConfig.name}`, error as Error);
          // 個別のフィードエラーは継続
        }
      }
      
      // 重複を除去して制限数まで返す
      return this.removeDuplicates(allItems).slice(0, limit);
      
    } catch (error) {
      return this.handleError(error, 'RSS collection');
    }
  }

  private transformFeedItem(item: any, sourceName: string, _query: string): RawContentData {
    return {
      title: item.title || 'Untitled',
      url: item.link || item.guid || '',
      summary: this.extractSummary(item),
      publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
      source: sourceName,
      type: 'rss',
      metadata: {
        author: item.creator || item.author || 'Unknown',
        categories: item.categories || [],
        guid: item.guid,
      },
    };
  }

  private extractSummary(item: any): string {
    // contentSnippetがある場合はそれを使用
    if (item.contentSnippet) {
      return item.contentSnippet.slice(0, 300) + '...';
    }
    
    // summaryまたはdescriptionから抽出
    const content = item.summary || item.description || item.content || '';
    
    // HTMLタグを除去
    const textContent = content.replace(/<[^>]*>/g, '');
    
    // 最初の300文字を返す
    return textContent.slice(0, 300) + (textContent.length > 300 ? '...' : '');
  }

  private matchesQuery(item: RawContentData, query: string): boolean {
    if (!query || query.trim() === '') return true;
    
    const searchText = query.toLowerCase();
    const contentToSearch = [
      item.title,
      item.summary,
      ...(item.metadata.categories || [])
    ].join(' ').toLowerCase();
    
    return contentToSearch.includes(searchText);
  }
}