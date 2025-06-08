import fs from 'fs/promises';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), '.next', 'cache', 'mock-articles');
const ARTICLES_FILE = path.join(STORAGE_DIR, 'articles.json');

export interface StoredArticle {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string | null;
  tags: string[];
  sources: Array<{
    title: string;
    url: string;
    type: string;
  }>;
  qualityScore: number;
  interestScore: number;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export class FileStorage {
  private static instance: FileStorage;

  private constructor() {}

  static getInstance(): FileStorage {
    if (!FileStorage.instance) {
      FileStorage.instance = new FileStorage();
    }
    return FileStorage.instance;
  }

  private async ensureDirectory(): Promise<void> {
    try {
      await fs.access(STORAGE_DIR);
    } catch {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
  }

  async readArticles(): Promise<StoredArticle[]> {
    try {
      await this.ensureDirectory();
      const data = await fs.readFile(ARTICLES_FILE, 'utf-8');
      return JSON.parse(data);
    } catch {
      // ファイルが存在しない場合は空配列を返す
      return [];
    }
  }

  async writeArticles(articles: StoredArticle[]): Promise<void> {
    await this.ensureDirectory();
    await fs.writeFile(ARTICLES_FILE, JSON.stringify(articles, null, 2));
  }

  async addArticle(article: StoredArticle): Promise<void> {
    const articles = await this.readArticles();
    // 重複チェック
    const existingIndex = articles.findIndex(a => a.id === article.id);
    if (existingIndex >= 0) {
      articles[existingIndex] = article;
    } else {
      articles.unshift(article); // 新しい記事を先頭に追加
    }
    await this.writeArticles(articles);
  }

  async getArticleById(id: string): Promise<StoredArticle | null> {
    const articles = await this.readArticles();
    return articles.find(a => a.id === id) || null;
  }

  async updateArticle(id: string, updatedArticle: StoredArticle): Promise<void> {
    const articles = await this.readArticles();
    const index = articles.findIndex(a => a.id === id);
    if (index >= 0) {
      articles[index] = updatedArticle;
      await this.writeArticles(articles);
    }
  }

  async deleteArticle(id: string): Promise<void> {
    const articles = await this.readArticles();
    const filteredArticles = articles.filter(a => a.id !== id);
    await this.writeArticles(filteredArticles);
  }

  async clearAll(): Promise<void> {
    await this.ensureDirectory();
    await this.writeArticles([]);
  }
}

export const fileStorage = FileStorage.getInstance();