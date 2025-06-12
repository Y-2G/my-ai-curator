import { ArticleGenerator } from '@/lib/ai/services/article-generator';
import { RawContentData } from '@/lib/ai/types';
import { NextRequest, NextResponse } from 'next/server';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ag = new ArticleGenerator();
    const { sources, userProfile, useOpenAI = true } = await request.json();

    if (!userProfile) {
      return NextResponse.json(
        {
          success: false,
          error: 'No user profile',
        },
        { status: 403 }
      );
    }

    // ソースデータの検証
    if (!sources || sources.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No sources provided',
        },
        { status: 400 }
      );
    }

    // RawContentData形式に変換
    const rawSources: RawContentData[] = sources.map((source: any) => ({
      title: source.title || '',
      url: source.url || '',
      summary: source.summary || source.description || '',
      publishedAt: source.publishedAt ? new Date(source.publishedAt) : new Date(),
      source: source.source || 'unknown',
      type: source.type || 'rss',
    }));

    let generatedArticle;
    let metadata: any = {
      sourcesProcessed: sources.length,
      useOpenAI,
    };

    // OpenAIを使用して記事生成
    try {
      const startTime = Date.now();
      const aiArticle = await ag.generateArticle(rawSources, userProfile);
      const processingTime = Date.now() - startTime;

      // カテゴリのマッピング（実際のDBカテゴリに合わせる）
      const categoryMap: Record<string, string> = {
        プログラミング: 'プログラミング',
        'AI・機械学習': 'AI・機械学習',
        Web開発: 'Web開発',
        DevOps: 'DevOps',
        セキュリティ: 'セキュリティ',
      };

      generatedArticle = {
        id: `article-${Date.now()}`,
        title: aiArticle.title,
        summary: aiArticle.summary,
        content: aiArticle.content,
        category: categoryMap[aiArticle.category] || 'プログラミング',
        tags: aiArticle.tags,
        sources: rawSources.map((source, index) => ({
          id: `source-${index}`,
          title: source.title,
          url: source.url,
          type: source.type,
        })),
        qualityScore: Math.round(aiArticle.confidence * 10),
        interestScore: 0, // 後で計算
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 興味度スコアの計算
      if (userProfile) {
        const interestResult = await ag.calculateInterestScore(
          rawSources[0], // 最初のソースで代表
          userProfile
        );
        generatedArticle.interestScore = interestResult.score;
        metadata.interestReasoning = interestResult.reasoning;
      }

      metadata = {
        ...metadata,
        processingTime,
        aiModel: 'gpt-4o-mini',
        confidence: aiArticle.confidence,
        wordCount: aiArticle.content.length,
      };
    } catch (aiError) {
      console.error('OpenAI generation error:', aiError);
      // OpenAIエラー時はフォールバック
      return [];
    }

    let savedArticle = null;

    try {
      const { articleService } = await import('@/lib/db/services/article-service');
      savedArticle = await articleService.createArticle({
        title: generatedArticle.title,
        summary: generatedArticle.summary,
        content: generatedArticle.content,
        category: generatedArticle.category,
        tags: generatedArticle.tags,
        sources: generatedArticle.sources.map((s) => ({
          title: s.title,
          url: s.url,
          type: s.type,
        })),
        qualityScore: generatedArticle.qualityScore,
        interestScore: generatedArticle.interestScore,
        publishedAt: new Date(generatedArticle.publishedAt),
      });
    } catch (saveError) {
      console.error('Failed to save article to database:', saveError);
      return NextResponse.json(
        {
          success: false,
          error: 'Article save failed',
          message: saveError instanceof Error ? saveError.message : 'Save error',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        article: generatedArticle,
        savedArticle: savedArticle
          ? {
              id: savedArticle.id,
              title: savedArticle.title,
              createdAt: savedArticle.createdAt,
            }
          : null,
        metadata: {
          ...metadata,
          savedToDatabase: !!savedArticle,
        },
        warnings: [],
      },
    });
  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Article generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
