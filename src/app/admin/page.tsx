'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { AuthManager } from '@/lib/auth';
import IntelligentCollectionComponent from '@/components/ui/IntelligentCollectionComponent';
import { UserProfile } from '@/lib/ai/types';
import { AVAILABLE_CATEGORIES, PREFERRED_STYLES, POPULAR_TAGS } from '@/lib/ai/constants';

function AdminPageContent() {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<{ id: string; email: string; name?: string } | null>(
    null
  );
  const [isFullPipelineRunning, setIsFullPipelineRunning] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState<string>('');
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchStatus, setBatchStatus] = useState<string>('');
  const router = useRouter();

  // フォーム状態
  const [formData, setFormData] = useState({
    name: '',
    preferredStyle: 'balanced' as const,
    bio: '',
    categories: [] as string[],
    tags: [] as string[],
    keywords: [] as string[],
  });

  const [newKeyword, setNewKeyword] = useState('');
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    // 認証チェック
    const isAuth = AuthManager.isAuthenticated();
    const currentUser = AuthManager.getUser();

    if (!isAuth || !currentUser) {
      // Not authenticated, redirecting to login
      router.push('/login');
      return;
    }

    setAuthUser(currentUser);
    loadUserProfile(currentUser.id);
  }, [router]);

  const loadUserProfile = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);
      // Loading admin profile

      // 認証トークンを取得
      const token = AuthManager.getToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/users/${userId}`, { headers });
      // Check response status

      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      // Profile loaded successfully

      if (data.success) {
        const userData = data.data;
        setUserProfile(userData);
        setFormData({
          name: userData.name || '',
          preferredStyle: userData.profile?.preferredStyle || 'balanced',
          bio: userData.profile?.bio || '',
          categories: userData.interests?.categories || [],
          tags: userData.interests?.tags || [],
          keywords: userData.userInterests?.map((ui: { keyword: string }) => ui.keyword) || [],
        });
      } else {
        setError('プロファイルの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Profile load error:', error);
      setError('プロファイルの読み込み中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!authUser?.id) {
      setError('ユーザー情報が取得できません');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);

      const updateData = {
        name: formData.name,
        profile: {
          preferredStyle: formData.preferredStyle,
          bio: formData.bio,
        },
        interests: {
          categories: formData.categories,
          tags: formData.tags,
          keywords: formData.keywords,
        },
      };

      // 認証トークンを取得
      const token = AuthManager.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/users/${authUser.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.success) {
        setUserProfile(data.data);
        setSuccessMessage('プロファイルを保存しました');
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.error || 'プロファイルの保存に失敗しました');
      }
    } catch (error) {
      console.error('Profile save error:', error);
      setError('保存中にエラーが発生しました');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    AuthManager.logout();
    router.push('/login');
  };

  const handleCategoryToggle = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((c) => c !== category)
        : [...prev.categories, category],
    }));
  };

  const handleTagToggle = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag],
    }));
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !formData.keywords.includes(newKeyword.trim())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim()],
      }));
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setFormData((prev) => ({
      ...prev,
      keywords: prev.keywords.filter((k) => k !== keyword),
    }));
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !formData.categories.includes(newCategory.trim())) {
      setFormData((prev) => ({
        ...prev,
        categories: [...prev.categories, newCategory.trim()],
      }));
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (category: string) => {
    setFormData((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c !== category),
    }));
  };

  const runBatchProcess = async () => {
    if (!authUser?.id) {
      setError('ユーザー情報が取得できません');
      return;
    }

    try {
      setIsBatchRunning(true);
      setError(null);
      setSuccessMessage(null);
      
      // 設定可能なパラメータ（将来的にUIから設定可能にできる）
      const batchConfig = {
        articlesToGenerate: 3,
        queryCount: 5,
        maxResultsPerQuery: 8,
        includeLatestTrends: true,
        searchDepth: 'intermediate' as const,
      };

      setBatchStatus('🔄 バッチ処理を開始しています...');

      // Step 1: AI情報収集
      setBatchStatus('🧠 AI検索クエリを生成中...');
      const token = AuthManager.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const collectionResponse = await fetch('/api/ai/intelligent-collection', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userProfile,
          options: {
            queryCount: batchConfig.queryCount,
            maxResultsPerQuery: batchConfig.maxResultsPerQuery,
            includeLatestTrends: batchConfig.includeLatestTrends,
            focusAreas: [],
            searchDepth: batchConfig.searchDepth,
          },
        }),
      });

      const collectionData = await collectionResponse.json();

      if (!collectionData.success) {
        throw new Error('AI情報収集に失敗: ' + collectionData.error);
      }

      setBatchStatus(
        `🔍 情報収集完了 - ${collectionData.data.statistics.totalResults}件の結果を取得`
      );

      if (collectionData.data.results.length === 0) {
        throw new Error('情報収集結果が0件のため、記事生成をスキップします');
      }

      // Step 2: 複数記事を並列生成
      setBatchStatus(`📝 ${batchConfig.articlesToGenerate}件の記事を生成中...`);

      // 収集した結果を記事ごとに分割
      const resultsPerArticle = Math.floor(
        collectionData.data.results.length / batchConfig.articlesToGenerate
      );
      const articlePromises = [];
      const articlesGenerated: Array<{
        title: string;
        id?: string;
        category: string;
        interestScore: number;
      }> = [];

      for (let i = 0; i < batchConfig.articlesToGenerate; i++) {
        const startIdx = i * resultsPerArticle;
        const endIdx =
          i === batchConfig.articlesToGenerate - 1
            ? collectionData.data.results.length
            : (i + 1) * resultsPerArticle;

        const sourcesForArticle = collectionData.data.results
          .slice(startIdx, endIdx)
          .map((result: { title: string; url: string; summary: string; publishedAt: string; source: string; type: string }) => ({
            title: result.title,
            url: result.url,
            summary: result.summary,
            publishedAt: result.publishedAt,
            source: result.source,
            type: result.type,
          }));

        if (sourcesForArticle.length > 0) {
          const promise = fetch('/api/ai/article-generate', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              sources: sourcesForArticle,
              userProfile,
              saveToDatabase: true,
              useOpenAI: true,
              categories: AVAILABLE_CATEGORIES,
            }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.success) {
                articlesGenerated.push({
                  title: data.article?.title || data.data?.article?.title || '無題',
                  id: data.savedArticle?.id || data.data?.savedArticle?.id,
                  category: data.article?.category || data.data?.article?.category || '未分類',
                  interestScore: data.article?.interestScore || data.data?.article?.interestScore || 0,
                });
                setBatchStatus(
                  `📝 記事生成中... (${articlesGenerated.length}/${batchConfig.articlesToGenerate})`
                );
              }
              return data;
            })
            .catch((error) => {
              console.error(`記事${i + 1}の生成エラー:`, error);
              return { success: false, error: error.message };
            });

          articlePromises.push(promise);
        }
      }

      // 並列実行して結果を待つ
      const articleResults = await Promise.all(articlePromises);

      setBatchStatus('');

      // 結果の集計
      const successCount = articleResults.filter((r) => r.success).length;
      const failCount = articleResults.length - successCount;

      // 詳細な結果メッセージ
      let resultMessage = `✅ バッチ処理完了！\n\n`;
      resultMessage += `📊 処理結果:\n`;
      resultMessage += `• 検索クエリ: ${collectionData.data.statistics.queryCount}件\n`;
      resultMessage += `• 検索結果: ${collectionData.data.statistics.totalResults}件\n`;
      resultMessage += `• 生成成功: ${successCount}件\n`;
      if (failCount > 0) {
        resultMessage += `• 生成失敗: ${failCount}件\n`;
      }

      if (articlesGenerated.length > 0) {
        resultMessage += `\n📚 生成された記事:\n`;
        articlesGenerated.forEach((article, idx) => {
          resultMessage += `${idx + 1}. ${article.title}\n`;
          resultMessage += `   カテゴリ: ${article.category} | 興味スコア: ${article.interestScore.toFixed(1)}\n`;
        });
      }

      setSuccessMessage(resultMessage);

      // 生成された記事を新しいタブで開く
      if (articlesGenerated.length > 0) {
        setTimeout(() => {
          articlesGenerated.forEach((article) => {
            if (article.id) {
              window.open(`/articles/${article.id}`, '_blank');
            }
          });
        }, 1000);
      }

      // エラーログ
      const errors = articleResults.filter((r) => !r.success).map((r) => r.error);
      if (errors.length > 0) {
        console.error('Batch process errors:', errors);
      }
    } catch (error) {
      console.error('Batch process error:', error);
      setError(error instanceof Error ? error.message : 'バッチ処理でエラーが発生しました');
      setBatchStatus('');
    } finally {
      setIsBatchRunning(false);
    }
  };

  const runFullPipeline = async () => {
    if (!authUser?.id) {
      setError('ユーザー情報が取得できません');
      return;
    }

    try {
      setIsFullPipelineRunning(true);
      setError(null);
      setSuccessMessage(null);
      setPipelineStatus('');

      // Step 1: AI情報収集
      setPipelineStatus('🧠 AI検索クエリを生成中...');
      // 認証トークンを取得
      const token = AuthManager.getToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const collectionResponse = await fetch('/api/ai/intelligent-collection', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userProfile,
          options: {
            queryCount: 5,
            maxResultsPerQuery: 8,
            includeLatestTrends: true,
            focusAreas: [],
            searchDepth: 'intermediate',
          },
        }),
      });

      const collectionData = await collectionResponse.json();

      if (!collectionData.success) {
        throw new Error('AI情報収集に失敗: ' + collectionData.error);
      }

      setPipelineStatus(
        '🔍 情報収集完了 - ' + collectionData.data.statistics.totalResults + '件の結果を取得'
      );

      if (collectionData.data.results.length === 0) {
        throw new Error('情報収集結果が0件のため、記事生成をスキップします');
      }

      // Step 2: 記事生成
      setPipelineStatus('📝 記事を生成中...');

      const sourcesToUse = collectionData.data.results.map((result: { title: string; url: string; summary: string; publishedAt: string; source: string; type: string }) => ({
        title: result.title,
        url: result.url,
        summary: result.summary,
        publishedAt: result.publishedAt,
        source: result.source,
        type: result.type,
      }));

      // 認証トークンを取得
      const headers2: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers2['Authorization'] = `Bearer ${token}`;
      }

      const articleResponse = await fetch('/api/ai/article-generate', {
        method: 'POST',
        headers: headers2,
        body: JSON.stringify({
          sources: sourcesToUse,
          userProfile,
          saveToDatabase: true,
          useOpenAI: true,
          categories: AVAILABLE_CATEGORIES,
        }),
      });

      const articleData = await articleResponse.json();
      // Article generated successfully

      if (!articleData.success) {
        throw new Error('記事生成に失敗: ' + articleData.error);
      }

      setPipelineStatus('');

      // 記事タイトルの安全な取得
      const articleTitle =
        articleData.article?.title || articleData.data?.article?.title || '新しい記事';
      const savedArticleId = articleData.savedArticle?.id || articleData.data?.savedArticle?.id;

      setSuccessMessage(`✅ 完了！記事「${articleTitle}」を生成し、データベースに保存しました`);

      // 生成された記事の詳細を表示
      if (savedArticleId) {
        setTimeout(() => {
          window.open(`/articles/${savedArticleId}`, '_blank');
        }, 1000);
      } else {
        // Article response received
      }
    } catch (error) {
      console.error('Full pipeline error:', error);
      setError(error instanceof Error ? error.message : '一気通貫処理でエラーが発生しました');
      setPipelineStatus('');
    } finally {
      setIsFullPipelineRunning(false);
    }
  };

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
          <div className="text-center mt-4 text-gray-600">管理者ページを読み込み中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-2">🔒 管理者ダッシュボード</h1>
            <p className="text-gray-600">My AI Curator の管理者設定とプロファイル管理</p>
          </div>
          <Button
            onClick={handleLogout}
            variant="secondary"
            className="text-red-600 border-red-300 hover:bg-red-50"
          >
            ログアウト
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

        {pipelineStatus && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              </div>
              <p className="text-blue-700 font-medium">{pipelineStatus}</p>
            </div>
          </div>
        )}

        {batchStatus && (
          <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
            <div className="flex items-center">
              <div className="mr-3">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
              </div>
              <p className="text-purple-700 font-medium">{batchStatus}</p>
            </div>
          </div>
        )}

        {userProfile && authUser && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-800 font-semibold">👤 ログイン中</p>
                <p className="text-blue-600 text-sm">
                  {authUser.name} ({authUser.email}) | 生成記事:{' '}
                  {userProfile.stats?.articlesCount || 0}件 | 興味キーワード:{' '}
                  {userProfile.stats?.interestsCount || 0}個 | 最終更新:{' '}
                  {new Date(userProfile.updatedAt).toLocaleDateString('ja-JP')}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">📊 システム状況</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>総記事数:</span>
                <span>{userProfile?.stats?.articlesCount || 0}件</span>
              </div>
              <div className="flex justify-between">
                <span>興味キーワード:</span>
                <span>{userProfile?.stats?.interestsCount || 0}個</span>
              </div>
              <div className="flex justify-between">
                <span>ステータス:</span>
                <span className="text-green-600">正常稼働</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">🚀 クイックアクション</h3>
            <div className="space-y-2">
              <Button
                onClick={runFullPipeline}
                disabled={isFullPipelineRunning || loading}
                className="w-full text-sm bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white"
              >
                {isFullPipelineRunning ? '⚡ 実行中...' : '⚡ AI記事生成（単発）'}
              </Button>
              <Button
                onClick={runBatchProcess}
                disabled={isBatchRunning || isFullPipelineRunning || loading}
                className="w-full text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {isBatchRunning ? '🔄 実行中...' : '🔄 バッチ記事生成（複数）'}
              </Button>
              <Button
                onClick={() => router.push('/articles')}
                className="w-full text-sm"
                variant="secondary"
              >
                📚 記事一覧を表示
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-2">🔧 管理メニュー</h3>
            <div className="space-y-2">
              <Button
                onClick={() => router.push('/admin/articles')}
                className="w-full text-sm"
                variant="secondary"
              >
                📋 記事一括管理
              </Button>
              <Button className="w-full text-sm" variant="secondary" disabled>
                ⚙️ システム設定
              </Button>
            </div>
          </Card>
        </div>

        {/* AI情報収集セクション */}
        <Card className="p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">🤖 AI情報収集</h2>
          <p className="text-gray-600 text-sm mb-4">
            あなたの興味プロファイルに基づいて、AIが自動で最新の技術情報を収集します
          </p>
          <IntelligentCollectionComponent userId={authUser?.id} userProfile={userProfile} />
        </Card>

        {/* プロファイル設定セクション（既存のコード） */}
        <div className="space-y-6">
          {/* 基本情報 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">基本情報</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="名前"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="お名前を入力"
              />

              <Select
                label="記事スタイル"
                value={formData.preferredStyle}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, preferredStyle: e.target.value as any }))
                }
                options={PREFERRED_STYLES}
                helperText="生成される記事のトーンを選択"
              />
            </div>

            <div className="mt-4">
              <Textarea
                label="自己紹介"
                value={formData.bio}
                onChange={(e) => setFormData((prev) => ({ ...prev, bio: e.target.value }))}
                placeholder="あなたの技術的背景や興味について簡潔に記載してください"
                rows={4}
                helperText="この情報は記事生成の際にパーソナライズに使用されます"
              />
            </div>
          </Card>

          {/* 興味カテゴリ */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">興味のあるカテゴリ</h2>
            <p className="text-gray-600 text-sm mb-4">
              関心のあるカテゴリを選択してください（複数選択可能）
            </p>

            {/* 既存カテゴリの選択 */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6 max-h-64 overflow-y-auto p-2 border border-gray-300 rounded-lg">
              {AVAILABLE_CATEGORIES.map((category) => (
                <label
                  key={category}
                  className={`flex items-center justify-between p-2 text-sm rounded-lg border cursor-pointer transition-colors ${
                    formData.categories.includes(category)
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.categories.includes(category)}
                      onChange={() => handleCategoryToggle(category)}
                      className="sr-only"
                    />
                    <span className="text-sm font-medium">{category}</span>
                  </div>
                  {formData.categories.includes(category) && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveCategory(category);
                      }}
                      className="ml-2 text-blue-500 hover:text-blue-700 text-xs"
                    >
                      ×
                    </button>
                  )}
                </label>
              ))}
            </div>

            {/* カスタムカテゴリ追加 */}
            <div className="pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">カスタムカテゴリを追加</p>
              <div className="flex gap-2 mb-4">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="新しいカテゴリを入力"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button onClick={handleAddCategory} disabled={!newCategory.trim()}>
                  追加
                </Button>
              </div>

              {/* 追加されたカスタムカテゴリ */}
              {formData.categories.filter((cat) => !AVAILABLE_CATEGORIES.includes(cat)).length >
                0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    追加済みカスタムカテゴリ:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {formData.categories
                      .filter((cat) => !AVAILABLE_CATEGORIES.includes(cat))
                      .map((category) => (
                        <span
                          key={category}
                          className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-700"
                        >
                          {category}
                          <button
                            onClick={() => handleRemoveCategory(category)}
                            className="ml-2 text-purple-500 hover:text-purple-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* 選択中のカテゴリ一覧 */}
              {formData.categories.length > 0 && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-600 mb-1">
                    選択中のカテゴリ ({formData.categories.length}個):
                  </p>
                  <p className="text-sm text-gray-700">{formData.categories.join(', ')}</p>
                </div>
              )}
            </div>
          </Card>

          {/* 興味のあるタグ */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">興味のあるタグ</h2>
            <p className="text-gray-600 text-sm mb-4">
              興味のある技術、ツール、トピックを選択してください
            </p>
            <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto p-3 border border-gray-300 rounded-lg">
              {POPULAR_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                    formData.tags.includes(tag)
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* 選択中のタグ一覧 */}
            {formData.tags.length > 0 && (
              <div className="mt-4 p-3 rounded-lg">
                <p className="text-xs font-medium text-gray-600 mb-1">
                  選択中のタグ ({formData.tags.length}個):
                </p>
                <div className="flex flex-wrap gap-1">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-2 rounded-full text-xs font-medium transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* カスタムキーワード */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">カスタムキーワード</h2>
            <p className="text-gray-600 text-sm mb-4">
              上記にない特定の技術や興味分野を追加できます
            </p>

            <div className="flex gap-2 mb-4">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="新しいキーワードを入力"
                onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              />
              <Button onClick={handleAddKeyword} disabled={!newKeyword.trim()}>
                追加
              </Button>
            </div>

            {formData.keywords.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">追加済みキーワード:</p>
                <div className="flex flex-wrap gap-2">
                  {formData.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-700"
                    >
                      {keyword}
                      <button
                        onClick={() => handleRemoveKeyword(keyword)}
                        className="ml-2 text-green-500 hover:text-green-700"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* 保存ボタン */}
          <div className="flex justify-end gap-4">
            <Button
              onClick={() => authUser?.id && loadUserProfile(authUser.id)}
              variant="secondary"
              disabled={saving}
            >
              リセット
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
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

export default function AdminPage() {
  return <AdminPageContent />;
}
