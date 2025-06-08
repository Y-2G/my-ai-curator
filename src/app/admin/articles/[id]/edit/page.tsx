'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { AuthManager } from '@/lib/auth';

interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category?: {
    id: string;
    name: string;
    color: string;
  } | null;
  tags: Array<{
    id: string;
    name: string;
  }>;
  sources: Array<{
    id: string;
    title: string;
    url: string;
    type: string;
  }>;
  interestScore: number;
  qualityScore: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EditArticlePageProps {
  params: Promise<{ id: string }>;
}

export default function EditArticlePage({ params }: EditArticlePageProps) {
  const [paramsResolved, setParamsResolved] = useState<{ id: string } | null>(null);
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const router = useRouter();

  // フォーム状態
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    category: '',
    selectedTags: [] as string[],
    interestScore: 0,
    qualityScore: 0,
    publishedAt: '',
  });

  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params;
      setParamsResolved(resolvedParams);
    };
    resolveParams();
  }, [params]);

  const loadArticle = useCallback(async () => {
    if (!paramsResolved) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/articles/${paramsResolved.id}`);
      const data = await response.json();

      if (data.success) {
        const articleData = data.data;
        setArticle(articleData);
        setFormData({
          title: articleData.title,
          summary: articleData.summary,
          content: articleData.content,
          category: articleData.category?.name || '',
          selectedTags: articleData.tags.map((tag: { name: string }) => tag.name),
          interestScore: articleData.interestScore,
          qualityScore: articleData.qualityScore,
          publishedAt: articleData.publishedAt
            ? new Date(articleData.publishedAt).toISOString().split('T')[0]
            : '',
        });
      } else {
        setError(data.error || '記事の読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Article load error:', error);
      setError('記事の読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [paramsResolved]);

  const loadFilters = async () => {
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
  };

  useEffect(() => {
    if (!paramsResolved) return;

    // 認証チェック
    const isAuth = AuthManager.isAuthenticated();
    const currentUser = AuthManager.getUser();

    if (!isAuth || !currentUser) {
      router.push('/login');
      return;
    }

    loadArticle();
    loadFilters();
  }, [paramsResolved, router, loadArticle]);

  const handleSave = async () => {
    if (!paramsResolved) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const updateData = {
        title: formData.title,
        summary: formData.summary,
        content: formData.content,
        category: formData.category || null,
        tags: formData.selectedTags,
        interestScore: formData.interestScore,
        qualityScore: formData.qualityScore,
        publishedAt: formData.publishedAt ? new Date(formData.publishedAt) : null,
      };

      const response = await fetch(`/api/articles/${paramsResolved.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage('記事を更新しました');
        setTimeout(() => {
          router.push('/admin/articles');
        }, 1500);
      } else {
        setError(data.error || '記事の更新に失敗しました');
      }
    } catch (error) {
      console.error('Article save error:', error);
      setError('更新中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleTagToggle = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.includes(tag)
        ? prev.selectedTags.filter((t) => t !== tag)
        : [...prev.selectedTags, tag],
    }));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.selectedTags.includes(newTag.trim())) {
      setFormData((prev) => ({
        ...prev,
        selectedTags: [...prev.selectedTags, newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedTags: prev.selectedTags.filter((t) => t !== tag),
    }));
  };

  const categoryOptions = [
    { value: '', label: 'カテゴリなし' },
    ...categories.map((cat) => ({ value: cat, label: cat })),
  ];

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-8"></div>
            <div className="space-y-6">
              <div className="h-64 bg-gray-200 rounded"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
          <div className="text-center mt-4 text-gray-600">記事を読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">記事が見つかりません</h1>
          <Button onClick={() => router.push('/admin/articles')} variant="secondary">
            記事管理に戻る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">✏️ 記事編集</h1>
            <p className="text-gray-600">記事の内容を編集します</p>
          </div>
          <Button onClick={() => router.push('/admin/articles')} variant="secondary">
            ← 記事管理に戻る
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

        <div className="space-y-6">
          {/* 基本情報 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">基本情報</h2>
            <div className="space-y-4">
              <Input
                label="タイトル"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="記事のタイトルを入力"
                required
              />

              <Textarea
                label="概要"
                value={formData.summary}
                onChange={(e) => setFormData((prev) => ({ ...prev, summary: e.target.value }))}
                placeholder="記事の概要を入力"
                rows={3}
                required
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="カテゴリ"
                  value={formData.category}
                  onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                  options={categoryOptions}
                />

                <Input
                  label="興味度 (%)"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.interestScore}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      interestScore: parseInt(e.target.value) || 0,
                    }))
                  }
                />

                <Input
                  label="品質スコア (%)"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.qualityScore}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      qualityScore: parseInt(e.target.value) || 0,
                    }))
                  }
                />
              </div>

              <Input
                label="公開日"
                type="date"
                value={formData.publishedAt}
                onChange={(e) => setFormData((prev) => ({ ...prev, publishedAt: e.target.value }))}
              />
            </div>
          </Card>

          {/* コンテンツ */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">記事内容</h2>
            <Textarea
              label="本文"
              value={formData.content}
              onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
              placeholder="記事の本文を入力"
              rows={15}
              required
            />
          </Card>

          {/* タグ */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">タグ</h2>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">既存のタグから選択</h3>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 border border-gray-200 rounded-lg">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      formData.selectedTags.includes(tag)
                        ? 'bg-blue-100 text-blue-700 border border-blue-300'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">新しいタグを追加</h3>
              <div className="flex gap-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="新しいタグを入力"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                />
                <Button onClick={handleAddTag} disabled={!newTag.trim()}>
                  追加
                </Button>
              </div>
            </div>

            {formData.selectedTags.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">選択中のタグ</h3>
                <div className="flex flex-wrap gap-2">
                  {formData.selectedTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-700"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-2 text-blue-500 hover:text-blue-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ソース情報（読み取り専用） */}
          {article.sources.length > 0 && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">参照元</h2>
              <div className="space-y-2">
                {article.sources.map((source, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">{source.title}</h4>
                        <p className="text-sm text-gray-600">{source.type}</p>
                      </div>
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        リンク →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 保存ボタン */}
          <div className="flex justify-end gap-4">
            <Button
              onClick={() => router.push('/admin/articles')}
              variant="secondary"
              disabled={saving}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                saving ||
                !formData.title.trim() ||
                !formData.summary.trim() ||
                !formData.content.trim()
              }
              className="bg-blue-600 hover:bg-blue-700 text-white px-8"
            >
              {saving ? '保存中...' : '保存する'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
