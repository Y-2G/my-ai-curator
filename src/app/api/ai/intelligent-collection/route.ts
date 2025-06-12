import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchQueryGenerator } from '@/lib/ai/services/search-query-generator';
import { webSearchCollector } from '@/lib/collectors/web-search-collector';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const startTime = Date.now();

    const { userProfile, options } = await request.json();

    if (!userProfile) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found or not authenticated',
        },
        { status: 404 }
      );
    }

    // AI検索クエリ生成
    // Generating search queries
    const searchQueries = await searchQueryGenerator.generateSearchQueries(userProfile, {
      count: (options as any).queryCount || 5,
      focusAreas: (options as any).focusAreas || [],
    });

    // Web検索実行
    const searchResults = await webSearchCollector.searchMultipleQueries(searchQueries, {
      maxResultsPerQuery: (options as any).maxResultsPerQuery || 8,
      concurrency: 3,
    });

    // 3. 結果の統合と整理
    const aggregatedResults: any[] = [];
    let totalResults = 0;
    const queryPerformance: any[] = [];

    for (const [query, searchResponse] of searchResults.entries()) {
      totalResults += searchResponse.results.length;

      queryPerformance.push({
        query,
        resultCount: searchResponse.results.length,
        processingTime: searchResponse.processingTime,
        success: searchResponse.success,
      });

      // 各検索結果を統合形式に変換
      searchResponse.results.forEach((result, index) => {
        // publishedAtの安全な処理
        let publishedAtStr = new Date().toISOString();
        if (result.publishedAt) {
          try {
            const date = new Date(result.publishedAt);
            if (!isNaN(date.getTime())) {
              publishedAtStr = date.toISOString();
            }
          } catch {
            console.warn('Invalid date for result:', result.title, result.publishedAt);
          }
        }

        aggregatedResults.push({
          id: `${query}-${index}`,
          title: result.title,
          url: result.url,
          summary: result.snippet,
          source: result.source,
          publishedAt: publishedAtStr,
          type: 'web_search',
          metadata: {
            searchQuery: query,
            relevanceScore: result.metadata?.relevanceScore || 0.5,
            domain: result.metadata?.domain,
            ...result.metadata,
          },
        });
      });
    }

    // 4. 関連度でソート
    aggregatedResults.sort(
      (a, b) => (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0)
    );

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: userProfile.id,
          name: userProfile.name,
          email: userProfile.email,
        },
        searchQueries: searchQueries.map((sq) => ({
          query: sq.query,
          category: sq.category,
          priority: sq.priority,
          reasoning: sq.reasoning,
        })),
        results: aggregatedResults,
        statistics: {
          totalQueries: searchQueries.length,
          totalResults,
          averageResultsPerQuery: totalResults / searchQueries.length,
          processingTime,
          queryPerformance,
        },
        metadata: {
          options,
          availableSearchApis: webSearchCollector.getAvailableApis(),
          generatedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('Intelligent collection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Intelligent collection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
