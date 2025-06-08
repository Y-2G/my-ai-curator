import Link from 'next/link';

interface CategoryBadgeProps {
  category: {
    id: string;
    name: string;
    color: string;
  };
  asLink?: boolean;
}

export function CategoryBadge({ category, asLink = true }: CategoryBadgeProps) {
  const badge = (
    <div className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1">
      <span className="font-medium" style={{ color: category.color }}>
        {category.name}
      </span>
    </div>
  );

  if (asLink) {
    return (
      <Link
        href={`/articles?category=${category.id}`}
        className="hover:opacity-80 transition-opacity"
      >
        {badge}
      </Link>
    );
  }

  return badge;
}
