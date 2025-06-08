'use client';

import type { CategoryWithCount } from '@/lib/types';
import Link from 'next/link';

interface CategoryGridProps {
  categories: CategoryWithCount[];
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">カテゴリから探す</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`/articles?category=${category.id}`}
            className="block group"
          >
            <div
              className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
              style={{ borderLeft: `4px solid ${category.color}` }}
            >
              <h3 className="text-xl font-semibold mb-2" style={{ color: category.color }}>
                {category.name}
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {category.articleCount || 0}件
                </span>
                <span className="text-blue-600 dark:text-blue-400">記事を見る →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
