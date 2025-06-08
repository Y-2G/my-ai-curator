'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CategoryBadge } from '@/components/article/CategoryBadge';
import { TagList } from '@/components/article/TagList';
import { AuthManager } from '@/lib/auth';

interface Article {
  id: string;
  title: string;
  summary: string;
  category?: {
    id: string;
    name: string;
    color: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
  }>;
  interestScore: number;
  qualityScore: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ArticleListResponse {
  articles: Article[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ArticleManagementPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [limit] = useState(10);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const router = useRouter();

  const loadArticles = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedTag && { tag: selectedTag }),
      });

      const response = await fetch(`/api/articles?${params}`);
      const data: { success: boolean; data?: ArticleListResponse; error?: string } =
        await response.json();

      if (data.success && data.data) {
        setArticles(data.data.articles);
        setTotal(data.data.total);
        setTotalPages(data.data.totalPages);
      } else {
        setError(data.error || '記事の読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Articles load error:', error);
      setError('記事の読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedCategory, selectedTag, limit]);

  const loadFilters = useCallback(async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/tags'),
      ]);

      const [categoriesData, tagsData] = await Promise.all([categoriesRes.json(), tagsRes.json()]);

      if (categoriesData.success) {
        setCategories(categoriesData.data.map((c: { name: string }) => c.name));
      }

      if (tagsData.success) {
        setTags(tagsData.data.map((t: { name: string }) => t.name));
      }
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  }, []);

  useEffect(() => {
    // 認証チェック
    const isAuth = AuthManager.isAuthenticated();
    const currentUser = AuthManager.getUser();

    if (!isAuth || !currentUser) {
      router.push('/login');
      return;
    }

    loadArticles();
    loadFilters();
  }, [page, searchTerm, selectedCategory, selectedTag, router, loadArticles, loadFilters]);

  const handleDelete = async (articleId: string) => {
    if (!confirm('この記事を削除してもよろしいですか？')) {
      return;
    }

    try {
      setDeletingIds((prev) => new Set([...prev, articleId]));
      setError(null);

      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('記事を削除しました');
        setTimeout(() => setSuccessMessage(null), 3000);
        await loadArticles(); // リロード
      } else {
        setError(data.error || '記事の削除に失敗しました');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError('削除中にエラーが発生しました');
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(articleId);
        return newSet;
      });
    }
  };

  const handleEdit = (articleId: string) => {
    router.push(`/admin/articles/${articleId}/edit`);
  };

  const handleView = (articleId: string) => {
    window.open(`/articles/${articleId}`, '_blank');
  };

  const handleSearch = () => {
    setPage(1);
    loadArticles();
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('');
    setSelectedTag('');
    setPage(1);
  };

  const categoryOptions = [
    { value: '', label: 'すべてのカテゴリ' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ];

  const tagOptions = [
    { value: '', label: 'すべてのタグ' },
    ...tags.map((tag) => ({ value: tag, label: tag })),
  ];

  if (loading && articles.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
          <div className="text-center mt-4 text-gray-600">記事一覧を読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">📋 記事管理</h1>
            <p className="text-gray-600">記事の管理・編集・削除を行います</p>
          </div>
          <Button onClick={() => router.push('/admin')} variant="secondary">
            ← 管理画面に戻る
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-700">{successMessage}</p>
          </div>
        )}

        {/* フィルター・検索 */}
        <Card className="p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">🔍 検索・フィルター</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Input
              label="記事タイトル・概要"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="検索キーワードを入力"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />

            <Select
              label="カテゴリ"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              options={categoryOptions}
            />

            <Select
              label="タグ"
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              options={tagOptions}
            />

            <div className="flex flex-col justify-end space-y-2">
              <Button onClick={handleSearch} className="w-full">
                検索
              </Button>
              <Button onClick={handleResetFilters} variant="secondary" className="w-full">
                リセット
              </Button>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            {total > 0 ? (
              <>
                全{total}件中 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}件を表示
              </>
            ) : (
              '記事が見つかりませんでした'
            )}
          </div>
        </Card>

        {/* 記事一覧 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">記事一覧</h2>

          {articles.length === 0 ? (
            <div className="text-center py-8 text-gray-500">記事が見つかりませんでした</div>
          ) : (
            <div className="space-y-4">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900 line-clamp-2">
                          {article.title}
                        </h3>
                        <div className="flex space-x-2 ml-4 flex-shrink-0">
                          <Button
                            onClick={() => handleView(article.id)}
                            size="sm"
                            variant="secondary"
                            className="text-blue-600 border-blue-300 hover:bg-blue-50"
                          >
                            表示
                          </Button>
                          <Button
                            onClick={() => handleEdit(article.id)}
                            size="sm"
                            variant="secondary"
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            編集
                          </Button>
                          <Button
                            onClick={() => handleDelete(article.id)}
                            size="sm"
                            variant="secondary"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                            disabled={deletingIds.has(article.id)}
                          >
                            {deletingIds.has(article.id) ? '削除中...' : '削除'}
                          </Button>
                        </div>
                      </div>

                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{article.summary}</p>

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                        <span>興味度: {article.interestScore}%</span>
                        <span>品質: {article.qualityScore}%</span>
                        <span>作成: {new Date(article.createdAt).toLocaleDateString('ja-JP')}</span>
                        {article.publishedAt && (
                          <span>
                            公開: {new Date(article.publishedAt).toLocaleDateString('ja-JP')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-4">
                        {article.category && <CategoryBadge category={article.category} />}
                        {article.tags.length > 0 && <TagList tags={article.tags} />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center space-x-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              variant="secondary"
            >
              前へ
            </Button>

            <div className="flex items-center space-x-1">
              {(() => {
                const startPage = Math.max(1, page - 2);
                const endPage = Math.min(totalPages, startPage + 4);
                const adjustedStartPage = Math.max(1, endPage - 4);

                const pages = [];
                for (let i = adjustedStartPage; i <= endPage; i++) {
                  pages.push(i);
                }

                return pages.map((pageNum) => (
                  <Button
                    key={`page-${pageNum}`}
                    onClick={() => setPage(pageNum)}
                    variant={page === pageNum ? 'primary' : 'secondary'}
                    size="sm"
                  >
                    {pageNum}
                  </Button>
                ));
              })()}
            </div>

            <Button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              variant="secondary"
            >
              次へ
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
