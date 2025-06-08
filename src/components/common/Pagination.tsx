'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  baseUrl: string;
  className?: string;
}

export function Pagination({ currentPage, totalPages, baseUrl, className }: PaginationProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (totalPages <= 1) return null;

  const getPageUrl = (page: number) => {
    // SSR時は基本的なURLを返す
    if (!mounted || typeof window === 'undefined') {
      return `${baseUrl}?page=${page}`;
    }
    
    const url = new URL(baseUrl, window.location.origin);
    // 既存のクエリパラメータを保持
    if (window.location.search) {
      const currentParams = new URLSearchParams(window.location.search);
      currentParams.forEach((value, key) => {
        if (key !== 'page') {
          url.searchParams.set(key, value);
        }
      });
    }
    url.searchParams.set('page', page.toString());
    return url.pathname + url.search;
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      pages.push(
        <Link key={1} href={getPageUrl(1)}>
          <Button variant="ghost" size="sm">
            1
          </Button>
        </Link>
      );
      if (start > 2) {
        pages.push(
          <span key="start-ellipsis" className="px-2">
            ...
          </span>
        );
      }
    }

    for (let i = start; i <= end; i++) {
      pages.push(
        <Link key={i} href={getPageUrl(i)}>
          <Button variant={i === currentPage ? 'primary' : 'ghost'} size="sm">
            {i}
          </Button>
        </Link>
      );
    }

    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push(
          <span key="end-ellipsis" className="px-2">
            ...
          </span>
        );
      }
      pages.push(
        <Link key={totalPages} href={getPageUrl(totalPages)}>
          <Button variant="ghost" size="sm">
            {totalPages}
          </Button>
        </Link>
      );
    }

    return pages;
  };

  return (
    <nav className={cn('flex items-center justify-center space-x-1', className)}>
      <Link
        href={getPageUrl(Math.max(1, currentPage - 1))}
        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
      >
        <Button variant="ghost" size="sm" disabled={currentPage === 1}>
          前へ
        </Button>
      </Link>

      {renderPageNumbers()}

      <Link
        href={getPageUrl(Math.min(totalPages, currentPage + 1))}
        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''}
      >
        <Button variant="ghost" size="sm" disabled={currentPage === totalPages}>
          次へ
        </Button>
      </Link>
    </nav>
  );
}
