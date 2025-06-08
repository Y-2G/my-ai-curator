import axios from 'axios';
import { BaseCollector } from './base';
import type { RawContentData } from '@/lib/types';
import { EXTERNAL_API_CONFIG } from '@/lib/config/external-apis';

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  updated_at: string;
  created_at: string;
  topics: string[];
  license: {
    key: string;
    name: string;
  } | null;
}

interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  author: {
    login: string;
  };
}

export class GitHubCollector extends BaseCollector {
  private baseUrl: string;
  private token?: string;

  constructor() {
    super('GitHub');
    this.baseUrl = EXTERNAL_API_CONFIG.github.baseUrl;
    this.token = process.env.GITHUB_TOKEN;
    
    if (!this.token) {
      this.logger.warn('GITHUB_TOKEN not found, using unauthenticated requests (lower rate limit)');
    }
  }

  async collect(query: string, limit: number): Promise<RawContentData[]> {
    try {
      await this.trackApiCall();

      // リポジトリ検索
      const repoResults = await this.searchRepositories(query, Math.ceil(limit * 0.7));
      
      // トレンドリポジトリ（最近更新されたもの）
      const trendingResults = await this.getTrendingRepositories(query, Math.ceil(limit * 0.3));

      const allResults = [...repoResults, ...trendingResults];
      return this.removeDuplicates(allResults).slice(0, limit);

    } catch (error) {
      return this.handleError(error, 'GitHub collection');
    }
  }

  private async searchRepositories(query: string, limit: number): Promise<RawContentData[]> {
    try {
      const response = await axios.get<GitHubSearchResponse>(
        `${this.baseUrl}/search/repositories`,
        {
          params: {
            q: `${query} language:typescript OR language:javascript OR language:python`,
            sort: 'stars',
            order: 'desc',
            per_page: Math.min(limit, 100),
          },
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      return response.data.items.map(repo => this.transformRepository(repo));

    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        this.logger.error('GitHub API rate limit exceeded');
      }
      throw error;
    }
  }

  private async getTrendingRepositories(query: string, limit: number): Promise<RawContentData[]> {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const dateString = oneWeekAgo.toISOString().split('T')[0];

      const response = await axios.get<GitHubSearchResponse>(
        `${this.baseUrl}/search/repositories`,
        {
          params: {
            q: `${query} created:>${dateString}`,
            sort: 'stars',
            order: 'desc',
            per_page: Math.min(limit, 30),
          },
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      return response.data.items.map(repo => this.transformRepository(repo, 'trending'));

    } catch (error) {
      this.logger.warn('Failed to fetch trending repositories', error as Error);
      return [];
    }
  }

  private transformRepository(repo: GitHubRepository, type: 'search' | 'trending' = 'search'): RawContentData {
    const description = repo.description || 'No description available';
    const summary = description.length > 300 
      ? description.slice(0, 300) + '...'
      : description;

    return {
      title: `${repo.full_name}${type === 'trending' ? ' 🔥' : ''}`,
      url: repo.html_url,
      summary: `${summary}\n\n⭐ ${repo.stargazers_count} stars | 🍴 ${repo.forks_count} forks${repo.language ? ` | 📝 ${repo.language}` : ''}`,
      publishedAt: repo.updated_at,
      source: 'GitHub',
      type: 'github',
      metadata: {
        author: repo.owner.login,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        language: repo.language,
        topics: repo.topics,
        openIssues: repo.open_issues_count,
        license: repo.license?.name,
        repositoryType: type,
        avatarUrl: repo.owner.avatar_url,
      },
    };
  }

  // 特定リポジトリのリリース情報を取得
  async getRepositoryReleases(owner: string, repo: string, limit = 5): Promise<RawContentData[]> {
    try {
      await this.trackApiCall();

      const response = await axios.get<GitHubRelease[]>(
        `${this.baseUrl}/repos/${owner}/${repo}/releases`,
        {
          params: {
            per_page: limit,
          },
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      return response.data
        .filter(release => release.published_at)
        .map(release => this.transformRelease(release, owner, repo));

    } catch (error) {
      return this.handleError(error, `GitHub releases for ${owner}/${repo}`);
    }
  }

  private transformRelease(release: GitHubRelease, owner: string, repo: string): RawContentData {
    const title = release.name || release.tag_name;
    const body = release.body || 'No release notes available';
    const summary = body.length > 300 
      ? body.slice(0, 300) + '...'
      : body;

    return {
      title: `${owner}/${repo} - ${title}`,
      url: release.html_url,
      summary: summary.replace(/#+\s*/g, '').replace(/\r\n/g, '\n'),
      publishedAt: release.published_at!,
      source: 'GitHub Releases',
      type: 'github',
      metadata: {
        author: release.author.login,
        tagName: release.tag_name,
        repository: `${owner}/${repo}`,
        releaseType: 'release',
      },
    };
  }

  // 人気の開発言語別検索
  async searchByLanguage(language: string, limit = 10): Promise<RawContentData[]> {
    try {
      await this.trackApiCall();

      const response = await axios.get<GitHubSearchResponse>(
        `${this.baseUrl}/search/repositories`,
        {
          params: {
            q: `language:${language}`,
            sort: 'stars',
            order: 'desc',
            per_page: limit,
          },
          headers: this.getHeaders(),
          timeout: 10000,
        }
      );

      return response.data.items.map(repo => this.transformRepository(repo));

    } catch (error) {
      return this.handleError(error, `GitHub search by language: ${language}`);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SmartCurator/1.0',
    };

    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    return headers;
  }

  // APIレート制限の詳細情報を取得
  async getRateLimitInfo(): Promise<{
    limit: number;
    remaining: number;
    resetTime: Date;
  } | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/rate_limit`, {
        headers: this.getHeaders(),
        timeout: 5000,
      });

      const rateLimit = response.data.rate;
      return {
        limit: rateLimit.limit,
        remaining: rateLimit.remaining,
        resetTime: new Date(rateLimit.reset * 1000),
      };

    } catch (error) {
      this.logger.error('Failed to get rate limit info', error as Error);
      return null;
    }
  }
}