import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { searchQueryGenerator } from '@/lib/ai/search-query-generator';
import { webSearchCollector } from '@/lib/collectors/web-search-collector';
import { PrismaClient } from '@prisma/client';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// リクエストスキーマ
const IntelligentCollectionSchema = z.object({
  userId: z.string().optional(),
  options: z.object({
    queryCount: z.number().min(1).max(10).default(5),
    maxResultsPerQuery: z.number().min(1).max(20).default(8),
    includeLatestTrends: z.boolean().default(true),
    focusAreas: z.array(z.string()).default([]),
    searchDepth: z.enum(['surface', 'intermediate', 'deep']).default('intermediate'),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, options = {} } = IntelligentCollectionSchema.parse(body);
    
    const startTime = Date.now();
    // Starting intelligent collection

    // ユーザープロファイルの取得
    let userProfile;
    if (userId) {
      userProfile = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          userInterests: {
            orderBy: { weight: 'desc' },
            take: 15,
          },
        },
      });
    }

    if (!userProfile) {
      return NextResponse.json({
        success: false,
        error: 'User not found or not authenticated',
      }, { status: 404 });
    }

    // User profile loaded successfully

    // 1. AI検索クエリ生成
    // Generating search queries
    const searchQueries = await searchQueryGenerator.generateSearchQueries(
      {
        id: userProfile.id,
        name: userProfile.name,
        email: userProfile.email,
        profile: userProfile.profile as { techLevel?: "beginner" | "intermediate" | "advanced"; preferredStyle?: "technical" | "casual" | "balanced"; bio?: string },
        interests: userProfile.interests as { categories?: string[]; tags?: string[]; keywords?: string[] },
        userInterests: userProfile.userInterests.map(ui => ({
          keyword: ui.keyword,
          weight: ui.weight,
          lastUsed: ui.lastUsed.toISOString(),
        })),
      },
      {
        count: (options as any).queryCount || 5,
        includeLatestTrends: (options as any).includeLatestTrends !== false,
        focusAreas: (options as any).focusAreas || [],
      }
    );

    // Search queries generated

    // 2. Web検索実行
    // Executing web searches
    const searchResults = await webSearchCollector.searchMultipleQueries(
      searchQueries,
      {
        maxResultsPerQuery: (options as any).maxResultsPerQuery || 8,
        concurrency: 3,
      }
    );

    // Web searches completed

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
    aggregatedResults.sort((a, b) => 
      (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0)
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
        searchQueries: searchQueries.map(sq => ({
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
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      }, { status: 400 });
    }

    console.error('Intelligent collection error:', error);
    return NextResponse.json({
      success: false,
      error: 'Intelligent collection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET(_request: NextRequest) {
  try {
    // 利用可能なAPIの確認
    const availableApis = webSearchCollector.getAvailableApis();
    
    return NextResponse.json({
      success: true,
      data: {
        service: 'AI-Powered Intelligent Collection',
        availableSearchApis: availableApis,
        features: [
          'User interest-based query generation',
          'Multi-source web search',
          'Relevance scoring',
          'Personalized content discovery',
        ],
        usage: {
          endpoint: '/api/ai/intelligent-collection',
          method: 'POST',
          parameters: {
            userId: 'string (required)',
            options: {
              queryCount: 'number (1-10, default: 5)',
              maxResultsPerQuery: 'number (1-20, default: 8)',
              includeLatestTrends: 'boolean (default: true)',
              focusAreas: 'string[] (optional)',
              searchDepth: 'surface|intermediate|deep (default: intermediate)',
            },
          },
        },
      },
    });

  } catch {
    return NextResponse.json({
      success: false,
      error: 'Service info failed',
    }, { status: 500 });
  }
}