'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from './Select';
import { Button } from './Button';
import { Badge } from './Badge';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  description: string | null;
  color: string;
  articleCount: number;
}

interface Tag {
  id: string;
  name: string;
  articleCount: number;
}

interface FilterPanelProps {
  className?: string;
  categories?: Category[];
  tags?: Tag[];
  showSortOptions?: boolean;
  variant?: 'full' | 'compact';
}

export function FilterPanel({
  className,
  categories = [],
  tags = [],
  showSortOptions = true,
  variant = 'full',
}: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedTag, setSelectedTag] = useState(searchParams.get('tag') || '');
  const [selectedSort, setSelectedSort] = useState(searchParams.get('sort') || 'createdAt');
  const [selectedOrder, setSelectedOrder] = useState(searchParams.get('order') || 'desc');

  const isCompact = variant === 'compact';
  const hasActiveFilters = selectedCategory || selectedTag;

  const updateUrl = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    // Reset to first page when filters change
    params.delete('page');

    router.push(`/articles?${params.toString()}`);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const categoryId = e.target.value;
    setSelectedCategory(categoryId);
    updateUrl({ category: categoryId || null });
  };

  const handleTagChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tagId = e.target.value;
    setSelectedTag(tagId);
    updateUrl({ tag: tagId || null });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const sort = e.target.value;
    setSelectedSort(sort);
    updateUrl({ sort: sort === 'createdAt' ? null : sort });
  };

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const order = e.target.value;
    setSelectedOrder(order);
    updateUrl({ order: order === 'desc' ? null : order });
  };

  const clearAllFilters = () => {
    setSelectedCategory('');
    setSelectedTag('');
    setSelectedSort('createdAt');
    setSelectedOrder('desc');

    const params = new URLSearchParams(searchParams);
    params.delete('category');
    params.delete('tag');
    params.delete('sort');
    params.delete('order');
    params.delete('page');

    router.push(`/articles?${params.toString()}`);
  };

  const categoryOptions = [
    { value: '', label: 'すべてのカテゴリ' },
    ...categories.map((cat) => ({
      value: cat.id,
      label: `${cat.name} (${cat.articleCount})`,
    })),
  ];

  const tagOptions = [
    { value: '', label: 'すべてのタグ' },
    ...tags.slice(0, 20).map((tag) => ({
      value: tag.id,
      label: `${tag.name} (${tag.articleCount})`,
    })),
  ];

  const sortOptions = [
    { value: 'createdAt', label: '投稿日時' },
    { value: 'interestScore', label: '興味度' },
    { value: 'qualityScore', label: '品質' },
  ];

  const orderOptions = [
    { value: 'desc', label: '降順' },
    { value: 'asc', label: '昇順' },
  ];

  if (isCompact) {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <Select
          value={selectedCategory}
          onChange={handleCategoryChange}
          options={categoryOptions}
          placeholder="カテゴリ"
          className="w-auto min-w-32"
        />

        <Select
          value={selectedTag}
          onChange={handleTagChange}
          options={tagOptions}
          placeholder="タグ"
          className="w-auto min-w-32"
        />

        {showSortOptions && (
          <>
            <Select
              value={selectedSort}
              onChange={handleSortChange}
              options={sortOptions}
              className="w-auto min-w-24"
            />

            <Select
              value={selectedOrder}
              onChange={handleOrderChange}
              options={orderOptions}
              className="w-auto min-w-20"
            />
          </>
        )}

        {hasActiveFilters && (
          <Button onClick={clearAllFilters} size="sm" className="text-xs">
            クリア
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Active Filters */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">フィルタ:</span>

          {selectedCategory && (
            <Badge
              className="cursor-pointer"
              onClick={() => {
                setSelectedCategory('');
                updateUrl({ category: null });
              }}
            >
              {categories.find((c) => c.id === selectedCategory)?.name}
              <span className="ml-1">×</span>
            </Badge>
          )}

          {selectedTag && (
            <Badge
              className="cursor-pointer"
              onClick={() => {
                setSelectedTag('');
                updateUrl({ tag: null });
              }}
            >
              {tags.find((t) => t.id === selectedTag)?.name}
              <span className="ml-1">×</span>
            </Badge>
          )}

          <Button
            onClick={clearAllFilters}
            variant="ghost"
            size="sm"
            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            すべてクリア
          </Button>
        </div>
      )}

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            カテゴリ
          </label>
          <Select
            value={selectedCategory}
            onChange={handleCategoryChange}
            options={categoryOptions}
            placeholder="選択してください"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            タグ
          </label>
          <Select
            value={selectedTag}
            onChange={handleTagChange}
            options={tagOptions}
            placeholder="選択してください"
          />
        </div>

        {showSortOptions && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                並び順
              </label>
              <Select value={selectedSort} onChange={handleSortChange} options={sortOptions} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                順序
              </label>
              <Select value={selectedOrder} onChange={handleOrderChange} options={orderOptions} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
