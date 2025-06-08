'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { CategoryBadge } from './CategoryBadge';
import { TagList } from './TagList';
import { InterestScore } from './InterestScore';
import { formatRelativeTime } from '@/lib/utils/date';
import type { Article } from '@/lib/types';

interface ArticleCardProps {
  article: Article;
  variant?: 'default' | 'featured' | 'compact';
}

export function ArticleCard({ article, variant = 'default' }: ArticleCardProps) {
  const isCompact = variant === 'compact';
  const isFeatured = variant === 'featured';

  return (
    <Card 
      hover
      padding={isCompact ? 'sm' : 'md'}
      className={isFeatured ? 'border-2 border-blue-500' : ''}
    >
      <article>
        <div className="flex items-start justify-between mb-3">
          {article.category && (
            <CategoryBadge category={article.category} />
          )}
          <InterestScore score={article.interestScore} size={isCompact ? 'sm' : 'md'} />
        </div>

        <h3 className={`font-semibold mb-2 line-clamp-2 ${isCompact ? 'text-lg' : 'text-xl'}`}>
          <Link 
            href={`/articles/${article.id}`}
            className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            {article.title}
          </Link>
        </h3>

        {!isCompact && (
          <p className="text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
            {article.summary}
          </p>
        )}

        <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
          <TagList tags={article.tags} limit={isCompact ? 2 : 3} />
          <time 
            dateTime={article.publishedAt}
            title={new Date(article.publishedAt).toLocaleString('ja-JP')}
          >
            {formatRelativeTime(article.publishedAt)}
          </time>
        </div>
      </article>
    </Card>
  );
}