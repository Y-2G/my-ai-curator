'use client';

import { useState } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';
import { Sheet } from '@/components/ui/Sheet';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-300 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:bg-gray-900/95 dark:border-gray-800">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link
              href="/"
              className="text-xl font-bold text-gray-900 hover:text-gray-700 dark:text-white dark:hover:text-gray-300"
            >
              {APP_NAME}
            </Link>

            <nav className="hidden md:flex items-center space-x-6">
              <Link
                href="/articles"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
              >
                記事一覧
              </Link>
              <Link
                href="/categories"
                className="text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white transition-colors"
              >
                カテゴリ
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <button
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              aria-label="Search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </button>

            {/* モバイルメニューボタン */}
            <button
              className="md:hidden p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              aria-label="Menu"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Sheet */}
      <Sheet isOpen={isMobileMenuOpen} onClose={closeMobileMenu}>
        <div className="flex h-full flex-col">
          {/* Sheet Header */}
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
            <Link
              href="/"
              onClick={closeMobileMenu}
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {APP_NAME}
            </Link>
            <button
              onClick={closeMobileMenu}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              aria-label="Close menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-1">
              <Link
                href="/articles"
                onClick={closeMobileMenu}
                className="block rounded-lg px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
              >
                記事一覧
              </Link>
              <Link
                href="/categories"
                onClick={closeMobileMenu}
                className="block rounded-lg px-4 py-3 text-base font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white transition-colors"
              >
                カテゴリ
              </Link>
            </div>
          </nav>

          {/* Search Section */}
          <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4">
            <button
              onClick={() => {
                closeMobileMenu();
                // TODO: Implement search functionality
              }}
              className="flex w-full items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              検索
            </button>
          </div>
        </div>
      </Sheet>
    </header>
  );
}
