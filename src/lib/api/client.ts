import type { Article, Category, Tag, ApiResponse } from '@/lib/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    // 認証ヘッダーを自動で追加
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // 既存のヘッダーをマージ
    if (options?.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    // クライアントサイドで認証トークンがある場合は追加
    if (typeof window !== 'undefined') {
      try {
        const authData = localStorage.getItem('smart-curator-auth');
        if (authData) {
          const { token } = JSON.parse(authData);
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
      } catch (error) {
        // 認証データの取得に失敗した場合はスキップ
        console.warn('Failed to get auth token:', error);
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  // 記事API
  async getArticles(params?: {
    page?: number;
    limit?: number;
    category?: string;
    tag?: string;
    sort?: 'createdAt' | 'interestScore' | 'qualityScore';
    order?: 'asc' | 'desc';
  }): Promise<
    ApiResponse<{ articles: Article[]; total: number; page: number; totalPages: number }>
  > {
    const searchParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }

    const queryString = searchParams.toString();
    const path = `/api/articles${queryString ? `?${queryString}` : ''}`;

    return this.fetch<
      ApiResponse<{ articles: Article[]; total: number; page: number; totalPages: number }>
    >(path);
  }

  async getArticle(id: string): Promise<ApiResponse<Article>> {
    return this.fetch<ApiResponse<Article>>(`/api/articles/${id}`);
  }

  // カテゴリAPI
  async getCategories(): Promise<ApiResponse<Category[]>> {
    return this.fetch<ApiResponse<Category[]>>('/api/categories');
  }

  // タグAPI
  async getTags(): Promise<ApiResponse<Tag[]>> {
    return this.fetch<ApiResponse<Tag[]>>('/api/tags');
  }
}

// シングルトンインスタンス
export const apiClient = new ApiClient();

// サーバーサイド用の関数
export async function getArticles(params?: Parameters<ApiClient['getArticles']>[0]) {
  try {
    const response = await apiClient.getArticles(params);

    if (!response.success || !response.data) {
      throw new Error('API returned error status');
    }

    return {
      articles: response.data.articles || [],
      pagination: {
        page: response.data.page,
        total: response.data.total,
        totalPages: response.data.totalPages,
      },
    };
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    // エラー時は空の配列を返す
    return {
      articles: [],
      pagination: { page: 1, total: 0, totalPages: 1 },
    };
  }
}

export async function getArticleById(id: string) {
  const response = await apiClient.getArticle(id);
  return response.data;
}

export async function getCategories() {
  const response = await apiClient.getCategories();
  if (!response.data) throw new Error('Failed to fetch categories');
  return response.data;
}

export async function getTags() {
  const response = await apiClient.getTags();
  if (!response.data) throw new Error('Failed to fetch tags');
  return response.data;
}
