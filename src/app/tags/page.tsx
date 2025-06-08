import Link from 'next/link';
import type { Metadata } from 'next';
import { Badge } from '@/components/ui/Badge';
import { TagModel } from '@/lib/db/models/tag';

export const metadata: Metadata = {
  title: 'タグ一覧',
  description: '人気のタグ一覧',
};

export default async function TagsPage() {
  try {
    const tags = await TagModel.findAll();

    // タグを記事数でグループ化
    const popularTags = tags.filter((tag) => tag._count.articleTags >= 5);
    const regularTags = tags.filter((tag) => tag._count.articleTags < 5);

    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">タグ一覧</h1>
          <p className="text-gray-600 dark:text-gray-400">タグから記事を探す</p>
        </div>

        {popularTags.length > 0 && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold mb-4">人気のタグ</h2>
            <div className="flex flex-wrap gap-3">
              {popularTags.map((tag) => (
                <Link key={tag.id} href={`/articles?tag=${tag.id}`} className="inline-block">
                  <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
                    <span className="font-medium text-blue-700 dark:text-blue-300">{tag.name}</span>
                    <Badge variant="info" size="sm">
                      {tag._count.articleTags}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {regularTags.length > 0 && (
          <section>
            <h2 className="text-xl font-semibold mb-4">すべてのタグ</h2>
            <div className="flex flex-wrap gap-2">
              {regularTags.map((tag) => (
                <Link key={tag.id} href={`/articles?tag=${tag.id}`} className="inline-block">
                  <Badge variant="default" size="md" className="hover:opacity-80 transition-opacity">
                    {tag.name} ({tag._count.articleTags})
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  } catch (error) {
    console.error('Failed to load tags:', error);
    return (
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">タグ一覧</h1>
          <p className="text-gray-600 dark:text-gray-400">タグから記事を探す</p>
        </div>
        <div className="text-center py-8 text-gray-500">
          タグを読み込めませんでした
        </div>
      </div>
    );
  }
}
