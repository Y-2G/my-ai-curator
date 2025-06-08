import { NextRequest } from 'next/server';
import { ArticleModel } from '@/lib/db/models/article';
import { successResponse, errorResponse } from '@/lib/api/response';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // クエリパラメータの取得
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category') || undefined;
    const tag = searchParams.get('tag') || undefined;

    // データベースから記事を取得
    const result = await ArticleModel.findMany({
      page,
      limit,
      categoryId: category,
      tagId: tag,
      sort: 'createdAt',
      order: 'desc',
    });

    // レスポンスデータの整形
    const articles = result.articles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      content: article.content,
      category: article.category
        ? {
            id: article.category.id,
            name: article.category.name,
            description: article.category.description,
            color: article.category.color,
          }
        : null,
      tags: article.articleTags.map((at) => ({
        id: at.tag.id,
        name: at.tag.name,
      })),
      sources: article.sources.map((source) => ({
        id: source.id,
        url: source.url,
        title: source.title,
        type: source.type,
      })),
      interestScore: article.interestScore,
      qualityScore: article.qualityScore,
      publishedAt: article.publishedAt?.toISOString() || null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    }));

    const responseData = {
      articles,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };

    return successResponse(responseData);
  } catch (error) {
    console.error('Articles API Error:', error);
    return errorResponse('記事の取得に失敗しました');
  }
}
