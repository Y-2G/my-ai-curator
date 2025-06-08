import { NextRequest, NextResponse } from 'next/server';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Dynamic imports to avoid build-time initialization
    const { ArticleModel } = await import('@/lib/db/models/article');
    const { prisma } = await import('@/lib/db/prisma');
    
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Article ID is required' },
        { status: 400 }
      );
    }

    // 現在の記事を取得
    const currentArticle = await ArticleModel.findById(id);
    if (!currentArticle) {
      return NextResponse.json(
        { success: false, error: 'Article not found' },
        { status: 404 }
      );
    }

    // 関連記事を検索（同じカテゴリか同じタグを持つ記事）
    const tagIds = currentArticle.articleTags.map(at => at.tag.id);
    
    // tagIdsが空の場合の対処
    const whereConditions = [];
    
    if (currentArticle.category?.id) {
      whereConditions.push({ categoryId: currentArticle.category.id });
    }
    
    if (tagIds.length > 0) {
      whereConditions.push({
        articleTags: {
          some: {
            tagId: { in: tagIds }
          }
        }
      });
    }
    
    // 条件がない場合は最新記事を返す
    const whereClause = whereConditions.length > 0 
      ? { id: { not: id }, OR: whereConditions }
      : { id: { not: id } };
    
    const relatedArticles = await prisma.article.findMany({
      where: whereClause,
      include: {
        category: true,
        articleTags: {
          include: { tag: true }
        }
      },
      take: 3,
      orderBy: { createdAt: 'desc' }
    });

    // レスポンス形式を統一
    const formattedArticles = relatedArticles.map((article) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      category: article.category?.name,
      tags: article.articleTags?.map((at) => at.tag.name) || [],
      qualityScore: article.qualityScore || 0,
      interestScore: article.interestScore || 0,
      publishedAt: article.publishedAt?.toISOString() || null,
      createdAt: article.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        articles: formattedArticles,
        count: formattedArticles.length,
      },
    });

  } catch (error) {
    console.error('Related articles API error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch related articles',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}