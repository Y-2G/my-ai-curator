import { NextRequest, NextResponse } from 'next/server';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Dynamic import to avoid build-time initialization
    const { ArticleModel } = await import('@/lib/db/models/article');
    
    const params = await context.params;
    const { id } = params;

    const article = await ArticleModel.findById(id);

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
          debug: {
            id,
            message: 'Article not found in database',
          },
        },
        { status: 404 }
      );
    }

    // レスポンスデータの整形
    const response = {
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
      tags: article.articleTags.map((at: { tag: { id: string; name: string } }) => ({
        id: at.tag.id,
        name: at.tag.name,
      })),
      sources: article.sources.map(
        (source: { id: string; url: string; title: string | null; type: string }) => ({
          id: source.id,
          url: source.url,
          title: source.title || '',
          type: source.type,
        })
      ),
      interestScore: article.interestScore,
      qualityScore: article.qualityScore,
      publishedAt: article.publishedAt?.toISOString() || null,
      createdAt: article.createdAt.toISOString(),
      updatedAt: article.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Article Detail API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Article not found',
      },
      { status: 404 }
    );
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Dynamic import to avoid build-time initialization
    const { articleService } = await import('@/lib/db/services/article-service');
    
    const params = await context.params;
    const { id } = params;
    const updateData = await request.json();

    const updatedArticle = await articleService.updateArticle(id, updateData);

    if (!updatedArticle) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedArticle,
    });
  } catch (error) {
    console.error('Article Update API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update article',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Dynamic import to avoid build-time initialization
    const { articleService } = await import('@/lib/db/services/article-service');
    
    const params = await context.params;
    const { id } = params;

    const deleted = await articleService.deleteArticle(id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Article not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Article deleted successfully',
    });
  } catch (error) {
    console.error('Article Delete API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete article',
      },
      { status: 500 }
    );
  }
}
