import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="container mx-auto flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">ページが見つかりません</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          お探しのページは存在しないか、移動した可能性があります。
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/">
            <Button>
              ホームに戻る
            </Button>
          </Link>
          <Link href="/articles">
            <Button variant="secondary">
              記事一覧へ
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}