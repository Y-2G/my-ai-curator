import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/security/logger';
import { env } from '@/lib/env';
import { prisma } from '@/lib/db/prisma';
import { AVAILABLE_CATEGORIES } from '@/lib/ai/constants';
import { UserProfile } from '@/lib/ai/types';
import jwt from 'jsonwebtoken';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// バッチ処理の設定
const BATCH_CONFIG = {
  queryCount: 5, // 生成するクエリ数
  maxResultsPerQuery: 8, // クエリあたりの最大結果数
  articlesToGenerate: 3, // 生成する記事数
  useOpenAI: true, // OpenAI使用フラグ
  includeLatestTrends: true,
  searchDepth: 'intermediate' as const,
};

// 型定義
interface BatchResults {
  searchQueries: number;
  searchResults: number;
  articlesGenerated: number;
  articlesDetail: Array<{
    title: string;
    id?: string;
    category: string;
    interestScore: number;
  }>;
  errors: string[];
}

interface CollectionResult {
  title: string;
  url: string;
  summary: string;
  publishedAt: string;
  source: string;
  type: string;
}

/**
 * バッチ処理のメインロジック
 */
async function runBatchProcess(userId: string): Promise<BatchResults> {
  const startTime = Date.now();
  const results: BatchResults = {
    searchQueries: 0,
    searchResults: 0,
    articlesGenerated: 0,
    articlesDetail: [],
    errors: [],
  };

  try {
    logger.info('BATCH_START', { userId, config: BATCH_CONFIG });

    // Step 1: ユーザー情報取得
    // userIdがemailの場合とIDの場合の両方に対応
    const isEmail = userId.includes('@');
    const user = await prisma.user.findUnique({
      where: isEmail ? { email: userId } : { id: userId },
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

    // UserProfileの構築
    const profile = user.profile as any;
    const interests = user.interests as any;

    const userProfile: UserProfile = {
      id: user.id,
      name: user.name || '',
      email: user.email || '',
      profile: {
        preferredStyle: profile?.preferredStyle || 'balanced',
        bio: profile?.bio || '',
      },
      interests: {
        categories: interests?.categories || [],
        tags: interests?.tags || [],
        keywords: user.userInterests?.map((ui) => ui.keyword) || [],
      },
      stats: {
        articlesCount: await prisma.article.count({ where: { authorId: { equals: user.id } } }),
        interestsCount: user.userInterests?.length || 0,
      },
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

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
          userProfile,
          options: {
            queryCount: BATCH_CONFIG.queryCount,
            maxResultsPerQuery: BATCH_CONFIG.maxResultsPerQuery,
            includeLatestTrends: BATCH_CONFIG.includeLatestTrends,
            focusAreas: [],
            searchDepth: BATCH_CONFIG.searchDepth,
          },
        }),
      }
    );

    const collectionData = await collectionResponse.json();

    if (!collectionData.success) {
      throw new Error('Collection failed: ' + collectionData.error);
    }

    results.searchQueries =
      collectionData.data.statistics.queryCount || collectionData.data.statistics.totalQueries;
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

    // 収集した結果を記事ごとに分割
    const resultsPerArticle = Math.floor(
      collectionData.data.results.length / BATCH_CONFIG.articlesToGenerate
    );
    const articlePromises = [];

    for (let i = 0; i < BATCH_CONFIG.articlesToGenerate; i++) {
      const startIdx = i * resultsPerArticle;
      const endIdx =
        i === BATCH_CONFIG.articlesToGenerate - 1
          ? collectionData.data.results.length
          : (i + 1) * resultsPerArticle;

      const sourcesForArticle = collectionData.data.results
        .slice(startIdx, endIdx)
        .map((result: CollectionResult) => ({
          title: result.title,
          url: result.url,
          summary: result.summary,
          publishedAt: result.publishedAt,
          source: result.source,
          type: result.type,
        }));

      if (sourcesForArticle.length > 0) {
        const promise = generateArticle(userProfile, sourcesForArticle, i + 1);
        articlePromises.push(promise);
      }
    }

    const articleResults = await Promise.allSettled(articlePromises);

    articleResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        results.articlesGenerated++;
        if (result.value.articleDetail) {
          results.articlesDetail.push(result.value.articleDetail);
        }
        logger.info('BATCH_ARTICLE_GENERATED', {
          userId,
          articleIndex: index + 1,
          articleId: result.value.articleId,
          title: result.value.articleDetail?.title,
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
  userProfile: UserProfile,
  sources: Array<{
    title: string;
    url: string;
    summary: string;
    publishedAt: string;
    source: string;
    type: string;
  }>,
  articleIndex: number
): Promise<{
  success: boolean;
  articleId?: string;
  articleDetail?: {
    title: string;
    id?: string;
    category: string;
    interestScore: number;
  };
  error?: string;
}> {
  try {
    const articleResponse = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/ai/article-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        sources,
        userProfile,
        saveToDatabase: true,
        useOpenAI: BATCH_CONFIG.useOpenAI,
        categories: AVAILABLE_CATEGORIES,
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
    const article = articleData.article || articleData.data?.article;

    return {
      success: true,
      articleId,
      articleDetail: article
        ? {
            title: article.title || '無題',
            id: articleId,
            category: article.category || '未分類',
            interestScore: article.interestScore || 0,
          }
        : undefined,
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
    // 認証チェック
    const authHeader = request.headers.get('Authorization');
    const cronSecret = request.headers.get('X-Cron-Secret');

    // トークンからユーザー認証
    let isSessionAuthorized = false;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
        if (decoded) isSessionAuthorized = true;
      } catch {
        // Invalid token
      }
    }

    // Cronシークレット、内部APIキー、またはセッション認証のいずれかで認証
    const isAuthorized =
      isSessionAuthorized ||
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
          articlesDetail: results.articlesDetail,
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

    // トークンからユーザー認証
    let isSessionAuthorized = false;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || '');
        if (decoded) isSessionAuthorized = true;
      } catch {
        // Invalid token
      }
    }

    if (
      !isSessionAuthorized &&
      authHeader !== `Bearer ${env.INTERNAL_API_KEY}` &&
      env.NODE_ENV === 'production'
    ) {
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
