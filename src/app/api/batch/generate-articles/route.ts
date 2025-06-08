import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/security/logger';
import { env } from '@/lib/env';
import { prisma } from '@/lib/db/prisma';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// バッチ処理の設定
const BATCH_CONFIG = {
  queryCount: 5, // 生成するクエリ数
  maxResultsPerQuery: 8, // クエリあたりの最大結果数
  articlesToGenerate: 3, // 生成する記事数
  useOpenAI: true, // OpenAI使用フラグ
};

/**
 * バッチ処理のメインロジック
 */
async function runBatchProcess(userId: string) {
  const startTime = Date.now();
  const results = {
    searchQueries: 0,
    searchResults: 0,
    articlesGenerated: 0,
    errors: [] as string[],
  };

  try {
    logger.info('BATCH_START', { userId, config: BATCH_CONFIG });

    // Step 1: ユーザー情報取得
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userInterests: {
          orderBy: { weight: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Step 2: AI情報収集
    logger.info('BATCH_COLLECTING', { userId });

    const collectionResponse = await fetch(
      `${env.NEXT_PUBLIC_APP_URL}/api/ai/intelligent-collection`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
        },
        body: JSON.stringify({
          userId,
          options: {
            queryCount: BATCH_CONFIG.queryCount,
            maxResultsPerQuery: BATCH_CONFIG.maxResultsPerQuery,
            includeLatestTrends: true,
            focusAreas: [],
            searchDepth: 'intermediate',
          },
        }),
      }
    );

    const collectionData = await collectionResponse.json();

    if (!collectionData.success) {
      throw new Error('Collection failed: ' + collectionData.error);
    }

    results.searchQueries = collectionData.data.statistics.totalQueries;
    results.searchResults = collectionData.data.statistics.totalResults;

    logger.info('BATCH_COLLECTION_COMPLETE', {
      userId,
      queries: results.searchQueries,
      results: results.searchResults,
    });

    if (collectionData.data.results.length === 0) {
      logger.warn('BATCH_NO_RESULTS', { userId });
      return results;
    }

    // Step 3: 記事生成（複数記事を並列処理）
    logger.info('BATCH_GENERATING_ARTICLES', { userId });

    const articlesToGenerate = Math.min(
      BATCH_CONFIG.articlesToGenerate,
      Math.ceil(collectionData.data.results.length / 5)
    );

    const generatePromises = [];

    for (let i = 0; i < articlesToGenerate; i++) {
      const startIdx = i * 5;
      const endIdx = Math.min((i + 1) * 5, collectionData.data.results.length);
      const sourcesForArticle = collectionData.data.results.slice(startIdx, endIdx);

      if (sourcesForArticle.length === 0) continue;

      const articlePromise = generateArticle(user, sourcesForArticle, i + 1);
      generatePromises.push(articlePromise);
    }

    const articleResults = await Promise.allSettled(generatePromises);

    articleResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.articlesGenerated++;
        logger.info('BATCH_ARTICLE_GENERATED', {
          userId,
          articleIndex: index + 1,
          articleId: result.value.articleId,
        });
      } else {
        const error =
          result.status === 'rejected'
            ? result.reason.message
            : result.value?.error || 'Unknown error';
        results.errors.push(`Article ${index + 1}: ${error}`);
        logger.error('BATCH_ARTICLE_ERROR', {
          userId,
          articleIndex: index + 1,
          error,
        });
      }
    });

    const duration = Date.now() - startTime;
    logger.info('BATCH_COMPLETE', {
      userId,
      results,
      duration,
    });

    return results;
  } catch (error) {
    logger.error('BATCH_ERROR', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * 単一記事の生成
 */
async function generateArticle(
  user: any,
  sources: any[],
  articleIndex: number
): Promise<{ success: boolean; articleId?: string; error?: string }> {
  try {
    const sourcesToUse = sources.map((result) => ({
      title: result.title,
      url: result.url,
      summary: result.summary,
      publishedAt: result.publishedAt,
      source: result.source,
      type: result.type,
    }));

    const articleProfile = {
      techLevel: user.profile?.techLevel || 'intermediate',
      interests: [...(user.interests?.categories || []), ...(user.interests?.tags || [])].slice(
        0,
        10
      ),
      preferredStyle: user.profile?.preferredStyle || 'balanced',
    };

    const articleResponse = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/articles/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        sources: sourcesToUse,
        userProfile: articleProfile,
        saveToDatabase: true,
        useOpenAI: BATCH_CONFIG.useOpenAI,
        metadata: {
          batchGenerated: true,
          articleIndex,
          generatedAt: new Date().toISOString(),
        },
      }),
    });

    const articleData = await articleResponse.json();

    if (!articleData.success) {
      return {
        success: false,
        error: articleData.error || 'Failed to generate article',
      };
    }

    const articleId = articleData.savedArticle?.id || articleData.data?.savedArticle?.id;

    return {
      success: true,
      articleId,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * バッチ実行用APIエンドポイント
 */
export async function POST(request: NextRequest) {
  try {
    // 認証チェック（Cronシークレットまたは内部APIキー）
    const authHeader = request.headers.get('Authorization');
    const cronSecret = request.headers.get('X-Cron-Secret');

    const isAuthorized =
      cronSecret === process.env.CRON_SECRET ||
      authHeader === `Bearer ${process.env.INTERNAL_API_KEY}`;

    if (!isAuthorized && env.NODE_ENV === 'production') {
      logger.security('BATCH_UNAUTHORIZED', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId is required' }, { status: 400 });
    }

    // バッチ処理を実行
    const results = await runBatchProcess(userId);

    // 統計情報を保存
    await prisma.collectionJob.create({
      data: {
        status: 'completed',
        startedAt: new Date(),
        completedAt: new Date(),
        articlesCreated: results.articlesGenerated,
        metadata: {
          userId,
          searchQueries: results.searchQueries,
          searchResults: results.searchResults,
          errors: results.errors,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: results,
      message: `Batch process completed: ${results.articlesGenerated} articles generated`,
    });
  } catch (error) {
    logger.error('BATCH_API_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // エラー情報を保存
    await prisma.collectionJob
      .create({
        data: {
          status: 'failed',
          startedAt: new Date(),
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          articlesCreated: 0,
        },
      })
      .catch(() => {}); // DB保存エラーは無視

    return NextResponse.json(
      {
        success: false,
        error: 'Batch process failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * バッチジョブの履歴取得
 */
export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${env.INTERNAL_API_KEY}` && env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const jobs = await prisma.collectionJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: jobs,
    });
  } catch (error) {
    logger.error('BATCH_HISTORY_ERROR', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch batch history',
      },
      { status: 500 }
    );
  }
}
