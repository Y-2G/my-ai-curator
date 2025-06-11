export interface SearchQuery {
  query: string;
  category: string;
  priority: number;
  reasoning: string;
  sources: string[];
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: Date;
  metadata?: {
    domain: string;
    relevanceScore: number;
    type: string;
  };
}

export interface SearchApiResponse {
  success: boolean;
  results: WebSearchResult[];
  totalResults: number;
  query: string;
  processingTime: number;
}

export class WebSearchCollector {
  private readonly GOOGLE_API_KEY = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  private readonly GOOGLE_CX = process.env.GOOGLE_CUSTOM_SEARCH_CX;
  private readonly SERP_API_KEY = process.env.SERP_API_KEY; // Alternative search API

  /**
   * 検索クエリに基づいてWeb検索を実行
   */
  async searchWithQuery(
    searchQuery: SearchQuery,
    options: {
      maxResults?: number;
      language?: string;
      region?: string;
      dateRestrict?: string; // 'd1' (past day), 'w1' (past week), 'm1' (past month)
    } = {}
  ): Promise<SearchApiResponse> {
    const { maxResults = 10, language = 'ja', region = 'JP', dateRestrict = 'm1' } = options;

    const startTime = Date.now();

    try {
      // 優先順位: Google Custom Search > SERP API > DuckDuckGo (free)
      let results: WebSearchResult[] = [];

      if (this.GOOGLE_API_KEY && this.GOOGLE_CX) {
        results = await this.searchWithGoogle(searchQuery.query, {
          maxResults,
          language,
          region,
          dateRestrict,
        });
      } else if (this.SERP_API_KEY) {
        results = await this.searchWithSerpApi(searchQuery.query, {
          maxResults,
          language,
          region,
        });
      } else {
        // フリーのフォールバック（制限あり）
        results = await this.searchWithDuckDuckGo(searchQuery.query, {
          maxResults: Math.min(maxResults, 5),
        });
      }

      // 関連度スコアリング
      const scoredResults = this.scoreResults(results, searchQuery);

      return {
        success: true,
        results: scoredResults,
        totalResults: results.length,
        query: searchQuery.query,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Web search error:', error);
      return {
        success: false,
        results: [],
        totalResults: 0,
        query: searchQuery.query,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * 複数のクエリを並列実行
   */
  async searchMultipleQueries(
    queries: SearchQuery[],
    options: {
      maxResultsPerQuery?: number;
      concurrency?: number;
    } = {}
  ): Promise<Map<string, SearchApiResponse>> {
    const { maxResultsPerQuery = 8, concurrency = 3 } = options;

    const results = new Map<string, SearchApiResponse>();

    // 優先度順にソート
    const sortedQueries = [...queries].sort((a, b) => b.priority - a.priority);

    // 並列実行（制限あり）
    for (let i = 0; i < sortedQueries.length; i += concurrency) {
      const batch = sortedQueries.slice(i, i + concurrency);

      const batchPromises = batch.map(async (query) => {
        const result = await this.searchWithQuery(query, {
          maxResults: maxResultsPerQuery,
        });
        return { query: query.query, result };
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.set(result.value.query, result.value.result);
        }
      });

      // レート制限を避けるため少し待機
      if (i + concurrency < sortedQueries.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Google Custom Search API
   */
  private async searchWithGoogle(
    query: string,
    options: {
      maxResults: number;
      language: string;
      region: string;
      dateRestrict?: string;
    }
  ): Promise<WebSearchResult[]> {
    const params = new URLSearchParams({
      key: this.GOOGLE_API_KEY!,
      cx: this.GOOGLE_CX!,
      q: query,
      num: Math.min(options.maxResults, 10).toString(),
      lr: `lang_${options.language}`,
      gl: options.region,
      safe: 'active',
    });

    if (options.dateRestrict) {
      params.append('dateRestrict', options.dateRestrict);
    }

    const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);

    if (!response.ok) {
      throw new Error(`Google Search API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.items || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'Google Search',
      publishedAt: this.parseDate(item.pagemap?.metatags?.[0]?.['article:published_time']),
      metadata: {
        domain: new URL(item.link).hostname,
        relevanceScore: 0.8,
        type: 'web',
      },
    }));
  }

  /**
   * SERP API (Alternative)
   */
  private async searchWithSerpApi(
    query: string,
    options: {
      maxResults: number;
      language: string;
      region: string;
    }
  ): Promise<WebSearchResult[]> {
    const params = new URLSearchParams({
      api_key: this.SERP_API_KEY!,
      q: query,
      num: Math.min(options.maxResults, 20).toString(),
      hl: options.language,
      gl: options.region,
    });

    const response = await fetch(`https://serpapi.com/search?${params}`);

    if (!response.ok) {
      throw new Error(`SERP API error: ${response.status}`);
    }

    const data = await response.json();

    return (data.organic_results || []).map((item: any) => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'SERP API',
      metadata: {
        domain: new URL(item.link).hostname,
        relevanceScore: 0.7,
        type: 'web',
      },
    }));
  }

  /**
   * DuckDuckGo Instant Answer API (Free, limited)
   */
  private async searchWithDuckDuckGo(
    query: string,
    options: {
      maxResults: number;
    }
  ): Promise<WebSearchResult[]> {
    try {
      // DuckDuckGo Instant Answer API（制限あり）
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        no_html: '1',
        skip_disambig: '1',
      });

      const response = await fetch(`https://api.duckduckgo.com/?${params}`);

      if (!response.ok) {
        throw new Error(`DuckDuckGo API error: ${response.status}`);
      }

      const data = await response.json();

      const results: WebSearchResult[] = [];

      // Abstract結果を追加
      if (data.Abstract) {
        results.push({
          title: data.Heading || query,
          url: data.AbstractURL || '#',
          snippet: data.Abstract,
          source: 'DuckDuckGo',
          publishedAt: undefined, // DuckDuckGoは日付情報を提供しない
          metadata: {
            domain: data.AbstractURL ? new URL(data.AbstractURL).hostname : 'duckduckgo.com',
            relevanceScore: 0.6,
            type: 'abstract',
          },
        });
      }

      // Related Topics結果を追加
      (data.RelatedTopics || []).slice(0, options.maxResults - 1).forEach((topic: any) => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
            source: 'DuckDuckGo',
            publishedAt: undefined, // DuckDuckGoは日付情報を提供しない
            metadata: {
              domain: new URL(topic.FirstURL).hostname,
              relevanceScore: 0.5,
              type: 'related',
            },
          });
        }
      });

      return results;
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      return [];
    }
  }

  /**
   * 検索結果の関連度スコアリング
   */
  private scoreResults(results: WebSearchResult[], searchQuery: SearchQuery): WebSearchResult[] {
    const queryTerms = searchQuery.query.toLowerCase().split(' ');

    return results
      .map((result) => {
        let score = result.metadata?.relevanceScore || 0.5;

        // タイトルでのキーワードマッチ
        const titleLower = result.title.toLowerCase();
        const titleMatches = queryTerms.filter((term) => titleLower.includes(term)).length;
        score += (titleMatches / queryTerms.length) * 0.3;

        // スニペットでのキーワードマッチ
        const snippetLower = result.snippet.toLowerCase();
        const snippetMatches = queryTerms.filter((term) => snippetLower.includes(term)).length;
        score += (snippetMatches / queryTerms.length) * 0.2;

        // ドメインの信頼性
        const trustedDomains = [
          'github.com',
          'stackoverflow.com',
          'qiita.com',
          'zenn.dev',
          'dev.to',
          'medium.com',
          'react.dev',
          'nextjs.org',
          'typescript.org',
        ];

        if (
          result.metadata?.domain &&
          trustedDomains.some((domain) => result.metadata!.domain.includes(domain))
        ) {
          score += 0.2;
        }

        return {
          ...result,
          metadata: {
            ...result.metadata!,
            relevanceScore: Math.min(1.0, score),
          },
        };
      })
      .sort((a, b) => (b.metadata?.relevanceScore || 0) - (a.metadata?.relevanceScore || 0));
  }

  /**
   * 日付パース
   */
  private parseDate(dateString?: string): Date | undefined {
    if (!dateString) return undefined;

    try {
      const date = new Date(dateString);
      // 有効な日付かチェック
      if (isNaN(date.getTime())) {
        return undefined;
      }
      return date;
    } catch {
      return undefined;
    }
  }

  /**
   * 利用可能な検索APIの確認
   */
  getAvailableApis(): string[] {
    const apis: string[] = [];

    if (this.GOOGLE_API_KEY && this.GOOGLE_CX) {
      apis.push('Google Custom Search');
    }

    if (this.SERP_API_KEY) {
      apis.push('SERP API');
    }

    apis.push('DuckDuckGo (Free)');

    return apis;
  }
}

export const webSearchCollector = new WebSearchCollector();
