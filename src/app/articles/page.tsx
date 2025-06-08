import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ArticleList } from '@/components/article/ArticleList';
import { Pagination } from '@/components/common/Pagination';
import { Loading } from '@/components/common/Loading';
import { getArticles } from '@/lib/api/client';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    tag?: string;
    sort?: string;
    order?: string;
  }>;
}

export const metadata: Metadata = {
  title: '記事一覧',
  description: 'AIがキュレーションした最新の技術記事一覧',
};

async function ArticlesContent({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const { articles, pagination } = await getArticles({
    page,
    limit: 12,
    category: params.category,
    tag: params.tag,
    sort: params.sort as 'createdAt' | 'interestScore' | 'qualityScore',
    order: params.order as 'asc' | 'desc',
  });

  return (
    <>
      <ArticleList articles={articles} />
      {pagination && (
        <div className="mt-12">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            baseUrl="/articles"
          />
        </div>
      )}
    </>
  );
}

export default function ArticlesPage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">記事一覧</h1>
        <p className="text-gray-600 dark:text-gray-400">AIがキュレーションした最新の技術記事</p>
      </div>

      <Suspense fallback={<Loading />}>
        <ArticlesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
