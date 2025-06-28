import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ArticleList } from '@/components/article/ArticleList';
import { Pagination } from '@/components/common/Pagination';
import { Loading } from '@/components/common/Loading';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterPanel } from '@/components/ui/FilterPanel';
import { ArticleModel, ArticleWithRelations } from '@/lib/db/models/article';
import { CategoryModel } from '@/lib/db/models/category';
import { TagModel } from '@/lib/db/models/tag';
import { Article, SourceType } from '@/lib/types';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    category?: string;
    tag?: string;
    search?: string;
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
    
    // Fetch data in parallel
    const [articlesResult, categories, tags] = await Promise.all([
      ArticleModel.findMany({
        page,
        limit: 12,
        categoryId: params.category,
        tagId: params.tag,
        search: params.search,
        sort: params.sort as 'createdAt' | 'interestScore' | 'qualityScore',
        order: params.order as 'asc' | 'desc',
      }),
      CategoryModel.findAllWithArticles(),
      TagModel.findPopular(20)
    ]);

    const articles = articlesResult.articles.map(transformArticleData);
    const pagination = {
      page: articlesResult.page,
      totalPages: articlesResult.totalPages,
      total: articlesResult.total,
      limit: 12,
    };

    // Transform categories and tags for FilterPanel
    const categoryOptions = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      color: cat.color,
      articleCount: cat._count.articles
    }));

    const tagOptions = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      articleCount: tag._count.articleTags
    }));

    return (
      <>
        {/* Search and Filter UI */}
        <div className="mb-8 space-y-6">
          {/* Search Input */}
          <div className="md:hidden">
            <SearchInput
              placeholder="記事を検索..."
              defaultValue={params.search || ''}
              className="w-full"
            />
          </div>

          {/* Filter Panel */}
          <FilterPanel
            categories={categoryOptions}
            tags={tagOptions}
            variant="full"
            className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6"
          />

          {/* Results Summary */}
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div>
              {params.search && (
                <p>
                  「<span className="font-medium text-gray-900 dark:text-white">{params.search}</span>」の検索結果
                </p>
              )}
              <p>
                {pagination.total}件の記事が見つかりました
                {pagination.totalPages > 1 && (
                  <span> (ページ {pagination.page}/{pagination.totalPages})</span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Articles List */}
        <ArticleList articles={articles} />
        
        {/* Pagination */}
        {pagination.totalPages > 1 && (
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
