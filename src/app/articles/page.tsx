import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ArticleList } from '@/components/article/ArticleList';
import { Pagination } from '@/components/common/Pagination';
import { Loading } from '@/components/common/Loading';
import { ArticleModel, ArticleWithRelations } from '@/lib/db/models/article';
import { Article, SourceType } from '@/lib/types';

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
  description: 'AIがキュレーションした最新記事一覧',
};

function transformArticleData(dbArticle: ArticleWithRelations): Article {
  return {
    id: dbArticle.id,
    title: dbArticle.title,
    summary: dbArticle.summary,
    content: dbArticle.content,
    category: dbArticle.category,
    tags: dbArticle.articleTags.map((at) => at.tag),
    sources: dbArticle.sources.map((source) => ({
      id: source.id,
      url: source.url,
      title: source.title,
      type: source.type as SourceType,
    })),
    interestScore: dbArticle.interestScore,
    qualityScore: dbArticle.qualityScore,
    publishedAt: dbArticle.publishedAt?.toISOString() || '',
    createdAt: dbArticle.createdAt.toISOString(),
    updatedAt: dbArticle.updatedAt.toISOString(),
  };
}

async function ArticlesContent({ searchParams }: PageProps) {
  try {
    const params = await searchParams;
    const page = parseInt(params.page || '1', 10);
    const result = await ArticleModel.findMany({
      page,
      limit: 12,
      categoryId: params.category,
      tagId: params.tag,
      sort: params.sort as 'createdAt' | 'interestScore' | 'qualityScore',
      order: params.order as 'asc' | 'desc',
    });

    const articles = result.articles.map(transformArticleData);
    const pagination = {
      page: result.page,
      totalPages: result.totalPages,
      total: result.total,
      limit: 12,
    };

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
  } catch (error) {
    console.error('Failed to load articles:', error);
    return <div className="text-center py-8 text-gray-500">記事を読み込めませんでした</div>;
  }
}

export const dynamic = 'force-dynamic';

export default function ArticlesPage({ searchParams }: PageProps) {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">記事一覧</h1>
        <p className="text-gray-600 dark:text-gray-400">AIがキュレーションした最新記事</p>
      </div>

      <Suspense fallback={<Loading />}>
        <ArticlesContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
