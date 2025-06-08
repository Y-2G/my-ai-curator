import axios from 'axios';
import { BaseCollector } from './base';
import type { RawContentData } from '@/lib/types';
import { EXTERNAL_API_CONFIG } from '@/lib/config/external-apis';

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsApiArticle[];
}

interface NewsApiArticle {
  source: {
    id: string | null;
    name: string;
  };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export class NewsCollector extends BaseCollector {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    super('News');
    this.apiKey = process.env.NEWS_API_KEY || '';
    this.baseUrl = EXTERNAL_API_CONFIG.newsApi.baseUrl;

    if (!this.apiKey) {
      this.logger.warn('NEWS_API_KEY not found, News collector will not function');
    }
  }

  async collect(query: string, limit: number): Promise<RawContentData[]> {
    if (!this.apiKey) {
      this.logger.error('NEWS_API_KEY is required for News collection');
      return [];
    }

    try {
      await this.trackApiCall();

      const response = await axios.get<NewsApiResponse>(
        `${this.baseUrl}${EXTERNAL_API_CONFIG.newsApi.endpoints.everything}`,
        {
          params: {
            q: query,
            sortBy: 'publishedAt',
            pageSize: Math.min(limit, 100), // News APIの制限
            language: 'en',
            apiKey: this.apiKey,
          },
          timeout: 10000,
        }
      );

      if (response.data.status !== 'ok') {
        throw new Error(`News API error: ${response.data.status}`);
      }

      const results = response.data.articles
        .filter((article) => this.isValidArticle(article))
        .map((article) => this.transformArticle(article))
        .slice(0, limit);

      this.logger.info(`Collected ${results.length} articles from News API`);
      return this.removeDuplicates(results);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          this.logger.error('News API rate limit exceeded');
        } else if (error.response?.status === 401) {
          this.logger.error('News API authentication failed - check API key');
        } else {
          this.logger.error('News API request failed', error);
        }
      } else if (error instanceof Error) {
        this.logger.error('News API request failed', error);
      }
      return this.handleError(error, 'News API collection');
    }
  }

  private isValidArticle(article: NewsApiArticle): boolean {
    return !!(
      article.title &&
      article.url &&
      article.publishedAt &&
      !article.title.includes('[Removed]') &&
      !article.url.includes('removed.com')
    );
  }

  private transformArticle(article: NewsApiArticle): RawContentData {
    return {
      title: article.title,
      url: article.url,
      summary: this.extractSummary(article),
      publishedAt: article.publishedAt,
      source: article.source.name || 'News API',
      type: 'news',
      metadata: {
        author: article.author || 'Unknown',
        sourceId: article.source.id,
        imageUrl: article.urlToImage,
        hasImage: !!article.urlToImage,
      },
    };
  }

  private extractSummary(article: NewsApiArticle): string {
    // descriptionを優先
    if (article.description) {
      return article.description.length > 300
        ? article.description.slice(0, 300) + '...'
        : article.description;
    }

    // contentから抽出
    if (article.content) {
      const cleanContent = article.content
        .replace(/\[\+\d+ chars\]$/, '') // News APIの省略記号を除去
        .replace(/<[^>]*>/g, ''); // HTMLタグを除去

      return cleanContent.length > 300 ? cleanContent.slice(0, 300) + '...' : cleanContent;
    }

    return 'No summary available';
  }

  // 特定のソース向けの検索
  async collectFromSources(
    query: string,
    sources: string[],
    limit: number
  ): Promise<RawContentData[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      await this.trackApiCall();

      const response = await axios.get<NewsApiResponse>(
        `${this.baseUrl}${EXTERNAL_API_CONFIG.newsApi.endpoints.everything}`,
        {
          params: {
            q: query,
            sources: sources.join(','),
            sortBy: 'publishedAt',
            pageSize: Math.min(limit, 100),
            apiKey: this.apiKey,
          },
          timeout: 10000,
        }
      );

      const results = response.data.articles
        .filter((article) => this.isValidArticle(article))
        .map((article) => this.transformArticle(article))
        .slice(0, limit);

      return this.removeDuplicates(results);
    } catch (error) {
      return this.handleError(error, 'News API source collection');
    }
  }

  // トップヘッドライン取得
  async getTopHeadlines(category?: string, country = 'us', limit = 20): Promise<RawContentData[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      await this.trackApiCall();

      const response = await axios.get<NewsApiResponse>(
        `${this.baseUrl}${EXTERNAL_API_CONFIG.newsApi.endpoints.topHeadlines}`,
        {
          params: {
            country,
            category,
            pageSize: Math.min(limit, 100),
            apiKey: this.apiKey,
          },
          timeout: 10000,
        }
      );

      const results = response.data.articles
        .filter((article) => this.isValidArticle(article))
        .map((article) => this.transformArticle(article))
        .slice(0, limit);

      return this.removeDuplicates(results);
    } catch (error) {
      return this.handleError(error, 'News API headlines collection');
    }
  }
}
