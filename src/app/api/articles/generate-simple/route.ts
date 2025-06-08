import { NextRequest, NextResponse } from 'next/server';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { sources, userTopic, saveToDatabase = false } = await request.json();

    // シンプルな記事生成（実際のAIなしでテスト）
    const generatedArticle = {
      id: `article-${Date.now()}`,
      title: `${userTopic || 'テクノロジー'}に関する最新情報まとめ`,
      summary: `${sources?.length || 0}件のソースから${userTopic || 'テクノロジー'}に関する重要な情報をまとめました。`,
      content: generateSimpleContent(sources, userTopic),
      category: 'テクノロジー',
      tags: extractTags(sources, userTopic),
      sources: (sources || []).map((source: any, index: number) => ({
        id: `source-${index}`,
        title: source.title || 'Untitled',
        url: source.url || '#',
        type: source.type || 'rss',
      })),
      qualityScore: 8,
      interestScore: 7,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

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
          sources: generatedArticle.sources.map(
            (s: { title: string; url: string; type: string }) => ({
              title: s.title,
              url: s.url,
              type: s.type,
            })
          ),
          qualityScore: generatedArticle.qualityScore,
          interestScore: generatedArticle.interestScore,
          publishedAt: new Date(generatedArticle.publishedAt),
        });

        // Article saved successfully
      } catch (saveError) {
        console.error('Failed to save article to database:', saveError);
        // 保存エラーでも記事生成は成功として返す
      }
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
          sourcesProcessed: sources?.length || 0,
          processingTime: 1200,
          wordCount: generatedArticle.content.length,
          savedToDatabase: !!savedArticle,
        },
        warnings: [],
      },
    });
  } catch (error) {
    console.error('Simple article generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Simple article generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

function generateSimpleContent(sources: any[], userTopic: string): string {
  const topic = userTopic || 'テクノロジー';
  const sourceCount = sources?.length || 0;

  return `# ${topic}の最新動向

## 概要

本記事では、${sourceCount}件の情報源から収集した${topic}に関する最新情報をまとめています。

## 主要なポイント

${
  sources
    ?.map(
      (source, index) => `
### ${index + 1}. ${source.title || '情報ソース'}

${source.summary || 'この情報源から重要な知見が得られました。'}

**ソース**: [${source.source || 'Unknown'}](${source.url || '#'})
`
    )
    .join('') || '・最新の技術動向について重要な情報があります。'
}

## まとめ

${topic}分野において、以下の点が重要であることが確認できました：

- 継続的な技術革新の重要性
- 実用的なアプローチの価値
- コミュニティとの連携の意義

今後もこの分野の発展に注目していく必要があります。

---
*この記事は${new Date().toLocaleDateString('ja-JP')}に生成されました。*
`;
}

function extractTags(sources: any[], userTopic: string): string[] {
  const baseTags = ['テクノロジー', '最新情報'];

  if (userTopic) {
    baseTags.push(userTopic);
  }

  // ソースから簡単なタグ抽出
  const additionalTags: string[] = [];
  sources?.forEach((source) => {
    if (source.title?.toLowerCase().includes('react')) additionalTags.push('React');
    if (source.title?.toLowerCase().includes('typescript')) additionalTags.push('TypeScript');
    if (
      source.title?.toLowerCase().includes('nextjs') ||
      source.title?.toLowerCase().includes('next.js')
    )
      additionalTags.push('Next.js');
    if (
      source.title?.toLowerCase().includes('ai') ||
      source.title?.toLowerCase().includes('artificial intelligence')
    )
      additionalTags.push('AI');
  });

  return [...baseTags, ...additionalTags].slice(0, 5);
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Simple article generation API is ready',
    timestamp: new Date().toISOString(),
  });
}
