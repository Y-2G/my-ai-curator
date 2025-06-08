'use client';

import { useState } from 'react';
import { Button } from './Button';
import { Select } from './Select';
import { Textarea } from './Textarea';
import { Card } from './Card';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  profile?: {
    techLevel?: 'beginner' | 'intermediate' | 'advanced';
    preferredStyle?: 'technical' | 'casual' | 'balanced';
    bio?: string;
    company?: string;
    location?: string;
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
}

interface SearchQuery {
  query: string;
  category: string;
  priority: number;
  reasoning: string;
}

interface SearchResult {
  id: string;
  title: string;
  url: string;
  summary: string;
  source: string;
  publishedAt: string;
  type: string;
  metadata: {
    searchQuery: string;
    relevanceScore: number;
    domain?: string;
  };
}

interface CollectionResponse {
  success: boolean;
  data: {
    user: { id: string; name: string; email: string };
    searchQueries: SearchQuery[];
    results: SearchResult[];
    statistics: {
      totalQueries: number;
      totalResults: number;
      averageResultsPerQuery: number;
      processingTime: number;
      queryPerformance: Array<{
        query: string;
        resultCount: number;
        processingTime: number;
        success: boolean;
      }>;
    };
    metadata: {
      options: any;
      availableSearchApis: string[];
      generatedAt: string;
    };
  };
  error?: string;
}

interface IntelligentCollectionComponentProps {
  userId?: string;
  userProfile?: UserProfile | null;
}

interface GeneratedArticle {
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  confidence: number;
}

const SEARCH_DEPTH_OPTIONS = [
  { value: 'surface', label: '概要・基本情報' },
  { value: 'intermediate', label: '実用的な情報・事例' },
  { value: 'deep', label: '技術的詳細・最新研究' },
];

export default function IntelligentCollectionComponent({
  userId,
  userProfile,
}: IntelligentCollectionComponentProps) {
  const [loading, setLoading] = useState(false);
  const [collectionResult, setCollectionResult] = useState<CollectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingArticle, setGeneratingArticle] = useState(false);
  const [generatedArticle, setGeneratedArticle] = useState<GeneratedArticle | null>(null);
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null);
  const [options, setOptions] = useState({
    queryCount: 5,
    maxResultsPerQuery: 8,
    includeLatestTrends: true,
    focusAreas: '',
    searchDepth: 'intermediate' as 'surface' | 'intermediate' | 'deep',
  });

  const executeIntelligentCollection = async () => {
    if (!userId || !userProfile) {
      setError('ユーザー情報が必要です');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setCollectionResult(null);

      const requestData = {
        userId,
        options: {
          queryCount: options.queryCount,
          maxResultsPerQuery: options.maxResultsPerQuery,
          includeLatestTrends: options.includeLatestTrends,
          focusAreas: options.focusAreas ? options.focusAreas.split(',').map(s => s.trim()).filter(Boolean) : [],
          searchDepth: options.searchDepth,
        },
      };

      const response = await fetch('/api/ai/intelligent-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (data.success) {
        setCollectionResult(data);
      } else {
        setError(data.error || 'AI情報収集に失敗しました');
      }
    } catch (error) {
      console.error('Intelligent collection error:', error);
      setError('実行中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms: number): string => {
    return `${(ms / 1000).toFixed(1)}秒`;
  };

  const getRelevanceColor = (score: number): string => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const generateArticleFromResults = async () => {
    if (!collectionResult || collectionResult.data.results.length === 0) {
      setError('記事生成に必要な収集結果がありません');
      return;
    }

    try {
      setGeneratingArticle(true);
      setError(null);
      setGeneratedArticle(null);
      setSavedArticleId(null);

      // 収集結果から上位の結果を記事生成用に変換
      const sourcesToUse = collectionResult.data.results.slice(0, 5).map(result => ({
        title: result.title,
        url: result.url,
        summary: result.summary,
        publishedAt: result.publishedAt,
        source: result.source,
        type: result.type,
      }));

      // ユーザープロファイルから記事生成用のプロファイルを作成
      const articleProfile = {
        techLevel: userProfile?.profile?.techLevel || 'intermediate',
        interests: [
          ...(userProfile?.interests?.categories || []),
          ...(userProfile?.interests?.tags || []),
        ].slice(0, 10),
        preferredStyle: userProfile?.profile?.preferredStyle || 'balanced',
      };

      const response = await fetch('/api/articles/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sources: sourcesToUse,
          userProfile: articleProfile,
          saveToDatabase: true,
          useOpenAI: true,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedArticle(data.article);
        if (data.savedArticle?.id) {
          setSavedArticleId(data.savedArticle.id);
        }
      } else {
        setError(data.error || '記事生成に失敗しました');
      }
    } catch (error) {
      console.error('Article generation error:', error);
      setError('記事生成中にエラーが発生しました');
    } finally {
      setGeneratingArticle(false);
    }
  };

  if (!userId || !userProfile) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg">
        <p className="text-gray-600">
          ユーザープロファイルが必要です。まず基本情報を保存してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 設定オプション */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            検索クエリ数
          </label>
          <select
            value={options.queryCount}
            onChange={(e) => setOptions(prev => ({ ...prev, queryCount: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[3, 5, 7, 10].map(num => (
              <option key={num} value={num}>{num}個</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            クエリあたりの結果数
          </label>
          <select
            value={options.maxResultsPerQuery}
            onChange={(e) => setOptions(prev => ({ ...prev, maxResultsPerQuery: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[5, 8, 10, 15].map(num => (
              <option key={num} value={num}>{num}件</option>
            ))}
          </select>
        </div>

        <Select
          label="探索深度"
          value={options.searchDepth}
          onChange={(e) => setOptions(prev => ({ ...prev, searchDepth: e.target.value as any }))}
          options={SEARCH_DEPTH_OPTIONS}
        />

        <div className="md:col-span-3">
          <Textarea
            label="特定の分野に絞る（カンマ区切り）"
            value={options.focusAreas}
            onChange={(e) => setOptions(prev => ({ ...prev, focusAreas: e.target.value }))}
            placeholder="例: React, TypeScript, Web開発"
            rows={2}
            helperText="空白の場合はプロファイル全体から検索"
          />
        </div>

        <div className="md:col-span-3">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={options.includeLatestTrends}
              onChange={(e) => setOptions(prev => ({ ...prev, includeLatestTrends: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">最新トレンドを含める</span>
          </label>
        </div>
      </div>

      {/* 実行ボタン */}
      <div className="text-center space-y-3">
        <div>
          <Button
            onClick={executeIntelligentCollection}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg"
          >
            {loading ? '🔍 AI収集中...' : '🚀 AI情報収集を開始'}
          </Button>
        </div>
        
      </div>
      
      {collectionResult && (
        <div className="text-center mt-2">
          <Button
            onClick={() => {
              setCollectionResult(null);
              setGeneratedArticle(null);
              setSavedArticleId(null);
              setError(null);
            }}
            variant="secondary"
            size="sm"
          >
            🔄 結果をクリア
          </Button>
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* 結果表示 */}
      {collectionResult && (
        <div className="space-y-6">
          {/* 記事生成ボタン */}
          {collectionResult.data.results.length > 0 && (
            <div className="text-center">
              <Button
                onClick={generateArticleFromResults}
                disabled={generatingArticle}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-3"
              >
                {generatingArticle ? '📝 記事生成中...' : '📝 収集結果から記事を生成'}
              </Button>
            </div>
          )}
          {/* 統計情報 */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">📊 収集結果統計</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">生成クエリ:</span>
                <p className="font-semibold">{collectionResult.data.statistics.totalQueries}個</p>
              </div>
              <div>
                <span className="text-gray-600">収集結果:</span>
                <p className="font-semibold">{collectionResult.data.statistics.totalResults}件</p>
              </div>
              <div>
                <span className="text-gray-600">平均結果数:</span>
                <p className="font-semibold">{collectionResult.data.statistics.averageResultsPerQuery.toFixed(1)}件/クエリ</p>
              </div>
              <div>
                <span className="text-gray-600">処理時間:</span>
                <p className="font-semibold">{formatTime(collectionResult.data.statistics.processingTime)}</p>
              </div>
            </div>
          </Card>

          {/* 生成されたクエリ */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">🎯 生成された検索クエリ</h3>
            <div className="space-y-3">
              {collectionResult.data.searchQueries.map((query, index) => (
                <div key={index} className="border-l-4 border-blue-400 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{query.query}</p>
                      <p className="text-sm text-gray-600">{query.reasoning}</p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                        {query.category}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">優先度: {query.priority}/10</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 収集結果 */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">📰 収集された情報</h3>
            <div className="space-y-4">
              {collectionResult.data.results.slice(0, 15).map((result, _index) => (
                <div key={result.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 hover:text-blue-600">
                      <a 
                        href={result.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {result.title}
                      </a>
                    </h4>
                    <span className={`text-xs font-medium ${getRelevanceColor(result.metadata.relevanceScore)}`}>
                      関連度: {(result.metadata.relevanceScore * 100).toFixed(0)}%
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">{result.summary}</p>
                  
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <div className="flex space-x-4">
                      <span>ソース: {result.source}</span>
                      <span>検索: {result.metadata.searchQuery}</span>
                      {result.metadata.domain && <span>ドメイン: {result.metadata.domain}</span>}
                    </div>
                    <span>{new Date(result.publishedAt).toLocaleDateString('ja-JP')}</span>
                  </div>
                </div>
              ))}
              
              {collectionResult.data.results.length > 15 && (
                <div className="text-center py-4">
                  <p className="text-gray-600">
                    他に {collectionResult.data.results.length - 15} 件の結果があります
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* システム情報 */}
          <Card className="p-4">
            <h3 className="text-lg font-semibold mb-3">⚙️ システム情報</h3>
            <div className="text-sm space-y-2">
              <div>
                <span className="text-gray-600">利用可能な検索API:</span>
                <span className="ml-2">{collectionResult.data.metadata.availableSearchApis.join(', ')}</span>
              </div>
              <div>
                <span className="text-gray-600">実行時刻:</span>
                <span className="ml-2">{new Date(collectionResult.data.metadata.generatedAt).toLocaleString('ja-JP')}</span>
              </div>
            </div>
          </Card>
        </div>
      )}
      
      {/* 生成された記事 */}
      {generatedArticle && (
        <div className="mt-8 space-y-6">
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">{generatedArticle.title}</h2>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>カテゴリ: {generatedArticle.category}</span>
                <span>信頼度: {(generatedArticle.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 font-medium mb-2">要約:</p>
              <p className="text-gray-600">{generatedArticle.summary}</p>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-700 font-medium mb-2">タグ:</p>
              <div className="flex flex-wrap gap-2">
                {generatedArticle.tags.map((tag, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            
            <details className="mt-4">
              <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                記事本文を表示
              </summary>
              <div className="mt-4 prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: generatedArticle.content.replace(/\n/g, '<br />') }} />
              </div>
            </details>
            
            {savedArticleId && (
              <div className="mt-6 flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-green-700 font-semibold">✅ 記事がデータベースに保存されました</p>
                  <p className="text-sm text-green-600">ID: {savedArticleId}</p>
                </div>
                <Button
                  onClick={() => window.open(`/articles/${savedArticleId}`, '_blank')}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  記事を表示
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}