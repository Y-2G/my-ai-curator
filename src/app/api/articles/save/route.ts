import { NextRequest, NextResponse } from 'next/server';
import { articleService } from '@/lib/db/services/article-service';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      title,
      summary,
      content,
      category,
      tags = [],
      sources = [],
      qualityScore = 0,
      interestScore = 0,
      publishedAt,
      metadata
    } = body;

    // バリデーション
    if (!title || !summary || !content) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Title, summary, and content are required' 
        },
        { status: 400 }
      );
    }

    // 記事を保存
    const article = await articleService.createArticle({
      title,
      summary,
      content,
      category,
      tags: Array.isArray(tags) ? tags : [],
      sources: Array.isArray(sources) ? sources : [],
      qualityScore: Number(qualityScore) || 0,
      interestScore: Number(interestScore) || 0,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      metadata: metadata || {},
    });

    return NextResponse.json({
      success: true,
      data: {
        article: {
          id: article.id,
          title: article.title,
          summary: article.summary,
          category: article.category?.name,
          tags: article.articleTags.map(at => at.tag.name),
          qualityScore: article.qualityScore,
          interestScore: article.interestScore,
          publishedAt: article.publishedAt,
          createdAt: article.createdAt,
        },
        message: 'Article saved successfully',
      },
    });

  } catch (error) {
    // 詳細なエラーログ
    console.error('Article save error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      env: process.env.NODE_ENV,
      databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save article',
        message: error instanceof Error ? error.message : 'Unknown error',
        debug: process.env.NODE_ENV === 'development' ? {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        } : undefined,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const search = searchParams.get('search') || undefined;

    const result = await articleService.getArticles({
      page,
      limit,
      category,
      tag,
      search,
    });

    const formattedArticles = result.articles.map((article: any) => ({
      id: article.id,
      title: article.title,
      summary: article.summary,
      category: article.category?.name,
      tags: article.articleTags?.map((at: any) => at.tag.name) || [],
      sources: article.sources?.map((source: any) => ({
        title: source.title,
        url: source.url,
        type: source.type,
      })) || [],
      qualityScore: article.qualityScore,
      interestScore: article.interestScore,
      publishedAt: article.publishedAt,
      createdAt: article.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        articles: formattedArticles,
        pagination: {
          page: result.page,
          limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      },
    });

  } catch (error) {
    console.error('Articles fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch articles',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}