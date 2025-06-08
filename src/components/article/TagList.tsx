import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';

interface TagListProps {
  tags: Array<{
    id: string;
    name: string;
  }> | string[];
  limit?: number;
  size?: 'sm' | 'md';
}

export function TagList({ tags, limit, size = 'sm' }: TagListProps) {
  // 文字列配列の場合はオブジェクト配列に変換
  const normalizedTags = tags.map((tag, index) => 
    typeof tag === 'string' 
      ? { id: `tag-${index}`, name: tag }
      : tag
  );
  
  const displayTags = limit ? normalizedTags.slice(0, limit) : normalizedTags;
  const remainingCount = limit && normalizedTags.length > limit ? normalizedTags.length - limit : 0;

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayTags.map((tag) => (
        <Link
          key={tag.id}
          href={`/articles?tag=${encodeURIComponent(tag.name)}`}
          className="hover:opacity-80 transition-opacity"
        >
          <Badge variant="default" size={size}>
            {tag.name}
          </Badge>
        </Link>
      ))}
      {remainingCount > 0 && (
        <Badge variant="default" size={size}>
          +{remainingCount}
        </Badge>
      )}
    </div>
  );
}