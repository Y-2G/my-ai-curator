import { ArticleCard } from './ArticleCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Article } from '@/lib/types';

interface ArticleListProps {
  articles: Article[];
  loading?: boolean;
  variant?: 'default' | 'featured' | 'compact';
}

export function ArticleList({ articles, loading = false, variant = 'default' }: ArticleListProps) {
  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <ArticleListSkeleton key={i} />
        ))}
      </div>
    );
  }

  // 安全性チェック: articlesが配列でない場合のエラーハンドリング
  if (!Array.isArray(articles)) {
    console.error('ArticleList: articles is not an array:', articles);
    return (
      <div className="text-center py-12">
        <p className="text-red-500 dark:text-red-400">
          記事データの形式が正しくありません。
          <br />
          <span className="text-sm">デバッグ: {typeof articles} - {JSON.stringify(articles).slice(0, 100)}...</span>
        </p>
      </div>
    );
  }

  if (articles.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">記事が見つかりませんでした。</p>
      </div>
    );
  }

  const gridClass = variant === 'compact' 
    ? 'grid gap-4' 
    : 'grid gap-6 md:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={gridClass}>
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} variant={variant} />
      ))}
    </div>
  );
}

function ArticleListSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <div className="flex items-start justify-between mb-3">
        <Skeleton width={80} height={24} className="rounded-full" />
        <Skeleton width={100} height={20} />
      </div>
      <Skeleton height={28} className="mb-2" />
      <Skeleton height={20} className="mb-1" />
      <Skeleton height={20} width="80%" className="mb-3" />
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton width={60} height={20} className="rounded-full" />
          <Skeleton width={60} height={20} className="rounded-full" />
        </div>
        <Skeleton width={80} height={16} />
      </div>
    </div>
  );
}