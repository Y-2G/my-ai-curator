import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleDetail } from '@/components/article/ArticleDetail';
import { getArticleById } from '@/lib/api/client';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const article = await getArticleById(id);
    
    if (!article) {
      return {
        title: '記事が見つかりません',
      };
    }

    return {
      title: article.title,
      description: article.summary,
      openGraph: {
        title: article.title,
        description: article.summary,
        type: 'article',
        publishedTime: article.publishedAt,
        tags: article.tags.map(t => t.name),
      },
    };
  } catch {
    return {
      title: '記事が見つかりません',
    };
  }
}

export default async function ArticlePage({ params }: PageProps) {
  let article;
  
  try {
    const { id } = await params;
    article = await getArticleById(id);
  } catch {
    notFound();
  }

  if (!article) {
    notFound();
  }

  return <ArticleDetail article={article} />;
}