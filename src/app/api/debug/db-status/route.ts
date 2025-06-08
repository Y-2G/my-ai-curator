import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // 基本的な接続テスト
    const connectionTest = await prisma.$queryRaw`SELECT 1 as test`;
    
    // カウントテスト
    const [userCount, articleCount, categoryCount] = await Promise.all([
      prisma.user.count().catch(() => -1),
      prisma.article.count().catch(() => -1),
      prisma.category.count().catch(() => -1),
    ]);
    
    const duration = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      data: {
        connection: 'OK',
        connectionTest,
        duration: `${duration}ms`,
        counts: {
          users: userCount,
          articles: articleCount,
          categories: categoryCount,
        },
        environment: {
          nodeEnv: process.env.NODE_ENV,
          databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
          databaseUrlNonPooling: process.env.DATABASE_URL_NON_POOLING ? 'SET' : 'NOT_SET',
          vercelEnv: process.env.VERCEL_ENV || 'NOT_SET',
        },
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    console.error('Database status check failed:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Database connection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        environment: {
          nodeEnv: process.env.NODE_ENV,
          databaseUrl: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
          databaseUrlNonPooling: process.env.DATABASE_URL_NON_POOLING ? 'SET' : 'NOT_SET',
          vercelEnv: process.env.VERCEL_ENV || 'NOT_SET',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}