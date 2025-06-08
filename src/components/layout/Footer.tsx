import Link from 'next/link';
import { APP_NAME } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="border-t border-gray-300 bg-gray-50 dark:bg-gray-900 dark:border-gray-800">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold mb-4">{APP_NAME}</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              私の興味に基づいてAIが検索・紹介する個人キュレーションブログ
            </p>
          </div>

          <div>
            <h4 className="font-semibold mb-4">コンテンツ</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/articles"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  記事一覧
                </Link>
              </li>
              <li>
                <Link
                  href="/categories"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  カテゴリ
                </Link>
              </li>
              <li>
                <Link
                  href="/tags"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  タグ
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">リンク</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/about"
                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  このサイトについて
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
