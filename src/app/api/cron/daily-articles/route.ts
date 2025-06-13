import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { logger } from '@/lib/security/logger';
import { env } from '@/lib/env';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cronジョブ用エンドポイント
 * vercel.jsonで設定:
 * {
 *   "crons": [{
 *     "path": "/api/cron/daily-articles",
 *     "schedule": "0 9 * * *"  // 毎日朝9時（UTC）
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Vercel Cronからのリクエストかチェック
    const headersList = headers();
    const authHeader = (await headersList).get('authorization');

    // Vercel CronはBearerトークンを送信
    if (env.NODE_ENV === 'production' && authHeader !== `Bearer ${env.CRON_SECRET}`) {
      logger.security('CRON_UNAUTHORIZED', {
        ip: request.headers.get('x-forwarded-for') || 'unknown',
      });
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('CRON_JOB_START', {
      path: '/api/cron/daily-articles',
      time: new Date().toISOString(),
      cronSecretLength: env.CRON_SECRET?.length || 0,
    });

    // 管理者ユーザーのIDを取得（実際の運用では設定から取得）
    const adminUserId = process.env.ADMIN_USER_ID || 'admin-user-id';

    // バッチ処理を実行
    const batchResponse = await fetch(`${env.NEXT_PUBLIC_APP_URL}/api/batch/generate-articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.INTERNAL_API_KEY}`,
      },
      body: JSON.stringify({
        userId: adminUserId,
      }),
    });

    const batchResult = await batchResponse.json();

    if (!batchResult.success) {
      throw new Error(batchResult.error || 'Batch process failed');
    }

    logger.info('CRON_JOB_COMPLETE', {
      path: '/api/cron/daily-articles',
      results: batchResult.data,
      duration: Date.now() - new Date().getTime(),
    });

    return NextResponse.json({
      success: true,
      message: 'Daily article generation completed',
      data: batchResult.data,
    });
  } catch (error) {
    logger.error('CRON_JOB_ERROR', {
      path: '/api/cron/daily-articles',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Cron job failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
