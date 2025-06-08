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

interface UserProfile {
  id: string;
  email: string;
  name: string;
  profile?: {
    techLevel?: 'beginner' | 'intermediate' | 'advanced';
    preferredStyle?: 'technical' | 'casual' | 'balanced';
    bio?: string;
  };
  interests?: {
    categories?: string[];
    tags?: string[];
    keywords?: string[];
  };
  userInterests?: Array<{
    id: string;
    keyword: string;
    weight: number;
    lastUsed: string;
  }>;
  stats?: {
    articlesCount?: number;
    interestsCount?: number;
  };
  createdAt: string;
  updatedAt: string;
}

const TECH_LEVELS = [
  { value: 'beginner', label: '初心者' },
  { value: 'intermediate', label: '中級者' },
  { value: 'advanced', label: '上級者' },
];

const PREFERRED_STYLES = [
  { value: 'technical', label: '技術的' },
  { value: 'casual', label: 'カジュアル' },
  { value: 'balanced', label: 'バランス型' },
];

const AVAILABLE_CATEGORIES = [
  // 技術系
  'プログラミング',
  'AI・機械学習',
  'Web開発',
  'モバイル開発',
  // ビジネス・キャリア
  'ビジネス',
  'スタートアップ',
  'キャリア',
  'マネジメント',
  // 一般的なトピック
  'ガジェット',
  'サイエンス',
  'デザイン',
  'マーケティング',
  // ライフスタイル
  '生産性',
  'リモートワーク',
  '学習・教育',
  'トレンド',
];

const POPULAR_TAGS = [
  // プログラミング言語・フレームワーク
  'React',
  'TypeScript',
  'Python',
  'JavaScript',
  'Next.js',
  'Vue.js',
  // AI・データ
  'ChatGPT',
  'AI',
  '機械学習',
  'データ分析',
  'ディープラーニング',
  // ツール・インフラ
  'GitHub',
  'Notion',
  'Figma',
  'Slack',
  'VSCode',
  // ビジネス・働き方
  'リモートワーク',
  'フリーランス',
  'スタートアップ',
  'DX',
  'プロダクトマネジメント',
  // トレンド・一般
  'Web3',
  'メタバース',
  'サステナビリティ',
  'イノベーション',
  'UX/UI',
  // 学習・スキル
  'オンライン学習',
  'スキルアップ',
  'キャリアチェンジ',
  'プログラミング学習',
  '資格',
];

function AdminPageContent() {
  const [user, setUser] = useState<UserProfile | null>(null);
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
    techLevel: 'intermediate' as const,
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
        setUser(userData);
        setFormData({
          name: userData.name || '',
          techLevel: userData.profile?.techLevel || 'intermediate',
          preferredStyle: userData.profile?.preferredStyle || 'balanced',
          bio: userData.profile?.bio || '',
          categories: userData.interests?.categories || [],
          tags: userData.interests?.tags || [],
          keywords: userData.userInterests?.map((ui: any) => ui.keyword) || [],
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
          techLevel: formData.techLevel,
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
        setUser(data.data);
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
      setBatchStatus('🔄 バッチ処理を開始しています...');

      const response = await fetch('/api/batch/generate-articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AuthManager.getToken()}`,
        },
        body: JSON.stringify({ userId: authUser.id }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'バッチ処理に失敗しました');
      }

      setBatchStatus('');

      const results = data.data;
      setSuccessMessage(
        `✅ バッチ処理完了！\n` +
          `検索クエリ: ${results.searchQueries}件\n` +
          `検索結果: ${results.searchResults}件\n` +
          `生成記事: ${results.articlesGenerated}件`
      );

      if (results.errors.length > 0) {
        console.error('Batch errors:', results.errors);
      }

      // 記事一覧を更新するため、数秒後にリロード
      setTimeout(() => {
        window.location.reload();
      }, 3000);
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
          userId: authUser.id,
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

      const sourcesToUse = collectionData.data.results.slice(0, 5).map((result: any) => ({
        title: result.title,
        url: result.url,
        summary: result.summary,
        publishedAt: result.publishedAt,
        source: result.source,
        type: result.type,
      }));

      const articleProfile = {
        techLevel: user?.profile?.techLevel || 'intermediate',
        interests: [...(user?.interests?.categories || []), ...(user?.interests?.tags || [])].slice(
          0,
          10
        ),
        preferredStyle: user?.profile?.preferredStyle || 'balanced',
      };

      // 認証トークンを取得
      const headers2: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers2['Authorization'] = `Bearer ${token}`;
      }

      const articleResponse = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: headers2,
        body: JSON.stringify({
          sources: sourcesToUse,
          userProfile: articleProfile,
          saveToDatabase: true,
          useOpenAI: true,
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

        {user && authUser && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-800 font-semibold">👤 ログイン中</p>
                <p className="text-blue-600 text-sm">
                  {authUser.name} ({authUser.email}) | 生成記事: {user.stats?.articlesCount || 0}件
                  | 興味キーワード: {user.stats?.interestsCount || 0}個 | 最終更新:{' '}
                  {new Date(user.updatedAt).toLocaleDateString('ja-JP')}
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
                <span>{user?.stats?.articlesCount || 0}件</span>
              </div>
              <div className="flex justify-between">
                <span>興味キーワード:</span>
                <span>{user?.stats?.interestsCount || 0}個</span>
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
          <IntelligentCollectionComponent userId={authUser?.id} userProfile={user} />
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
                label="技術レベル"
                value={formData.techLevel}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, techLevel: e.target.value as any }))
                }
                options={TECH_LEVELS}
                helperText="AIが記事の難易度を調整する際に使用"
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
