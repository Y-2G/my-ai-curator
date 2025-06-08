import { NextRequest, NextResponse } from 'next/server';
import { openAIService } from '@/lib/ai/openai-service';
import type { UserProfile, RawContentData } from '@/lib/ai/openai-service';

export async function POST(request: NextRequest) {
  try {
    const { 
      sources, 
      userProfile,
      saveToDatabase = false,
      useOpenAI = true 
    } = await request.json();

    // ソースデータの検証
    if (!sources || sources.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No sources provided',
      }, { status: 400 });
    }

    // ユーザープロファイルのデフォルト値
    const profile: UserProfile = userProfile || {
      techLevel: 'intermediate',
      interests: ['Web開発', 'AI・機械学習', 'DevOps'],
      preferredStyle: 'balanced',
    };

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

    if (useOpenAI) {
      // OpenAIを使用して記事生成
      try {
        const startTime = Date.now();
        const aiArticle = await openAIService.generateArticle(rawSources, profile);
        const processingTime = Date.now() - startTime;

        // カテゴリのマッピング（実際のDBカテゴリに合わせる）
        const categoryMap: Record<string, string> = {
          'プログラミング': 'プログラミング',
          'AI・機械学習': 'AI・機械学習',
          'Web開発': 'Web開発',
          'DevOps': 'DevOps',
          'セキュリティ': 'セキュリティ',
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
        if (profile) {
          const interestResult = await openAIService.calculateInterestScore(
            rawSources[0], // 最初のソースで代表
            profile
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
        return fallbackGeneration(sources, profile);
      }
    } else {
      // OpenAIを使わない場合（テスト用）
      return fallbackGeneration(sources, profile);
    }

    let savedArticle = null;

    // データベースに保存する場合
    if (saveToDatabase) {
      try {
        const { articleService } = await import('@/lib/db/services/article-service');
        savedArticle = await articleService.createArticle({
          title: generatedArticle.title,
          summary: generatedArticle.summary,
          content: generatedArticle.content,
          category: generatedArticle.category,
          tags: generatedArticle.tags,
          sources: generatedArticle.sources.map(s => ({
            title: s.title,
            url: s.url,
            type: s.type,
          })),
          qualityScore: generatedArticle.qualityScore,
          interestScore: generatedArticle.interestScore,
          publishedAt: new Date(generatedArticle.publishedAt),
        });

        // Article saved to database successfully
      } catch (saveError) {
        console.error('Failed to save article to database:', saveError);
        // 保存エラーでも記事生成は成功として返す
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        article: generatedArticle,
        savedArticle: savedArticle ? {
          id: savedArticle.id,
          title: savedArticle.title,
          createdAt: savedArticle.createdAt,
        } : null,
        metadata: {
          ...metadata,
          savedToDatabase: !!savedArticle,
        },
        warnings: [],
      },
    });

  } catch (error) {
    console.error('Article generation error:', error);
    return NextResponse.json({
      success: false,
      error: 'Article generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// フォールバック用の簡易生成
function fallbackGeneration(sources: any[], profile: UserProfile) {
  const topic = profile.interests[0] || 'テクノロジー';
  const generatedArticle = {
    id: `article-${Date.now()}`,
    title: `${topic}に関する最新情報まとめ`,
    summary: `${sources?.length || 0}件のソースから${topic}に関する重要な情報をまとめました。`,
    content: generateSimpleContent(sources, topic),
    category: 'プログラミング',
    tags: ['テクノロジー', '最新情報', topic],
    sources: (sources || []).map((source: any, index: number) => ({
      id: `source-${index}`,
      title: source.title || 'Untitled',
      url: source.url || '#',
      type: source.type || 'rss',
    })),
    qualityScore: 7,
    interestScore: 5,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return NextResponse.json({
    success: true,
    data: {
      article: generatedArticle,
      savedArticle: null,
      metadata: {
        sourcesProcessed: sources?.length || 0,
        useOpenAI: false,
        fallback: true,
        wordCount: generatedArticle.content.length,
        savedToDatabase: false,
      },
      warnings: ['Using fallback generation due to OpenAI error'],
    },
  });
}

function generateSimpleContent(sources: any[], topic: string): string {
  return `# ${topic}の最新動向

## 概要

本記事では、${sources?.length || 0}件の情報源から収集した${topic}に関する最新情報をまとめています。

## 主要なポイント

${sources?.slice(0, 5).map((source, index) => `
### ${index + 1}. ${source.title || '情報ソース'}

${source.summary || source.description || 'この情報源から重要な知見が得られました。'}

**ソース**: [${source.source || 'Unknown'}](${source.url || '#'})
`).join('') || '・最新の技術動向について重要な情報があります。'}

## まとめ

${topic}分野において、継続的な技術革新と実用的なアプローチの重要性が確認できました。

---
*この記事は${new Date().toLocaleDateString('ja-JP')}に生成されました。*
`;
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Article generation API with OpenAI integration is ready',
    features: [
      'OpenAI-powered article generation',
      'Interest score calculation',
      'Automatic categorization',
      'Tag generation',
      'Fallback support',
    ],
    timestamp: new Date().toISOString(),
  });
}