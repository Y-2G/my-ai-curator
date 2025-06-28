'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from './Button';
import { cn } from '@/lib/utils';

interface SearchInputProps {
  placeholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  defaultValue?: string;
  autoFocus?: boolean;
  variant?: 'default' | 'compact';
  initialSearchParams?: URLSearchParams;
}

export function SearchInput({
  placeholder = '記事を検索...',
  className,
  onSearch,
  defaultValue = '',
  autoFocus = false,
  variant = 'default',
  initialSearchParams,
}: SearchInputProps) {
  const [searchQuery, setSearchQuery] = useState(defaultValue);
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Only access searchParams on the client
  const currentSearchParams = useMemo(() => {
    return isClient ? searchParams : (initialSearchParams || new URLSearchParams());
  }, [isClient, searchParams, initialSearchParams]);

  const handleSearch = useCallback(() => {
    const trimmedQuery = searchQuery.trim();

    if (onSearch) {
      onSearch(trimmedQuery);
      return;
    }

    // Default behavior: update URL search params
    const params = new URLSearchParams(currentSearchParams);

    if (trimmedQuery) {
      params.set('search', trimmedQuery);
    } else {
      params.delete('search');
    }

    // Reset to first page when searching
    params.delete('page');

    router.push(`/articles?${params.toString()}`);
  }, [searchQuery, onSearch, router, currentSearchParams]);

  const handleClear = useCallback(() => {
    setSearchQuery('');

    if (onSearch) {
      onSearch('');
      return;
    }

    // Default behavior: clear search param from URL
    const params = new URLSearchParams(currentSearchParams);
    params.delete('search');
    params.delete('page');

    router.push(`/articles?${params.toString()}`);
  }, [onSearch, router, currentSearchParams]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const isCompact = variant === 'compact';

  return (
    <div className={cn('relative flex items-center', className)}>
      <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg
            className="h-4 w-4 text-gray-400"
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

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className={cn(
            'w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'placeholder:text-gray-400 text-sm',
            'dark:bg-gray-800 dark:border-gray-600 dark:text-white dark:placeholder:text-gray-500',
            isCompact && 'py-1.5 text-xs'
          )}
        />

        {searchQuery && (
          <button
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label="検索をクリア"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {!isCompact && (
        <Button onClick={handleSearch} className="ml-2 px-4 py-2" size="sm">
          検索
        </Button>
      )}
    </div>
  );
}
