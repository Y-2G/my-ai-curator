import Link from 'next/link';
import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { getCategories } from '@/lib/api/client';
import type { CategoryWithCount } from '@/lib/db/models/category';

export const metadata: Metadata = {
  title: 'カテゴリ一覧',
  description: '記事カテゴリ一覧',
};

export default async function CategoriesPage() {
  const categories = (await getCategories()) as CategoryWithCount[];

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">カテゴリ一覧</h1>
        <p className="text-gray-600 dark:text-gray-400">興味のあるカテゴリから記事を探す</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Link key={category.id} href={`/articles?category=${category.id}`} className="block">
            <div style={{ borderLeft: `4px solid ${category.color}` }}>
              <Card hover className="h-full">
                <h2 className="text-xl font-semibold mb-2" style={{ color: category.color }}>
                  {category.name}
                </h2>
                {category.description && (
                  <p className="text-gray-600 dark:text-gray-400 mb-4">{category.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {category._count?.articles || 0}件の記事
                  </span>
                  <span className="text-blue-600 dark:text-blue-400">記事を見る →</span>
                </div>
              </Card>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
