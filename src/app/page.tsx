import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/Button';
import { ArticleList } from '@/components/article/ArticleList';
import { Loading } from '@/components/common/Loading';
import { CategoryGrid } from '@/components/category/CategoryGrid';
import { CategoryWithCount, Article, SourceType } from '@/lib/types';
import { ArticleModel, ArticleWithRelations } from '@/lib/db/models/article';
import { CategoryModel } from '@/lib/db/models/category';

// データ変換関数
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

function transformCategoryData(dbCategory: any): CategoryWithCount {
  return {
    id: dbCategory.id,
    name: dbCategory.name,
    description: dbCategory.description,
    color: dbCategory.color,
    articleCount: dbCategory._count.articles,
  };
}

async function FeaturedArticles() {
  try {
    const result = await ArticleModel.findMany({
      limit: 6,
      sort: 'interestScore',
    });
    const articles = result.articles.map(transformArticleData);

    return (
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">注目の記事</h2>
          <Link href="/articles">
            <Button variant="ghost" size="sm">
              すべて見る →
            </Button>
          </Link>
        </div>
        <ArticleList articles={articles} />
      </section>
    );
  } catch (error) {
    console.error('Failed to load featured articles:', error);
    return (
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">最新の記事</h2>
          <Link href="/articles">
            <Button variant="ghost" size="sm">
              すべて見る →
            </Button>
          </Link>
        </div>
        <div className="text-center py-8 text-gray-500">記事を読み込めませんでした</div>
      </section>
    );
  }
}

async function CategorySection() {
  try {
    const dbCategories = await CategoryModel.findAllWithArticles();
    const categories = dbCategories.map(transformCategoryData);

    return (
      <section className="mb-12">
        <CategoryGrid categories={categories} />
      </section>
    );
  } catch (error) {
    console.error('Failed to load categories:', error);
    return (
      <section className="mb-12">
        <div className="text-center py-8 text-gray-500">カテゴリを読み込めませんでした</div>
      </section>
    );
  }
}

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ヒーローセクション */}
      <section className="bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 py-20">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-white">
            私の興味を共有する
            <br />
            <span className="text-blue-600 dark:text-blue-400">キュレーションブログ</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
            私の興味に合わせた記事をAIが収集・紹介しています。
            <br />
            個人的なキュレーションブログです。
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/articles">
              <Button size="lg">記事を読む</Button>
            </Link>
            <Link href="/about">
              <Button variant="secondary" size="lg">
                詳しく見る
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* メインコンテンツ */}
      <div className="container mx-auto py-12">
        {/* カテゴリセクション */}
        <Suspense fallback={<Loading />}>
          <CategorySection />
        </Suspense>

        {/* 注目記事セクション */}
        <Suspense fallback={<Loading />}>
          <FeaturedArticles />
        </Suspense>
      </div>

      {/* 特徴セクション */}
      <section className="bg-gray-50 dark:bg-gray-900 py-16">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">このブログの特徴</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">AIによる記事発見</h3>
              <p className="text-gray-600 dark:text-gray-400">
                私の興味に合わせてAIが最新の記事を自動で検索・発見します
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">個別記事紹介</h3>
              <p className="text-gray-600 dark:text-gray-400">
                各記事をタイトル・リンク・要約付きで個別に紹介し、読みたい記事を簡単に見つけられます
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">個人的なキュレーション</h3>
              <p className="text-gray-600 dark:text-gray-400">
                私の興味や関心に基づいた、パーソナルなキュレーションをお届けします
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
