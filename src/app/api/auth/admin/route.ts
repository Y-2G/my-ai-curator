import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

export async function GET(_request: NextRequest) {
  try {
    // 管理者ユーザーの情報を取得
    const adminEmail = process.env.ADMIN_USER_ID;
    if (!adminEmail) {
      return NextResponse.json(
        {
          success: false,
          error: 'ADMIN_USER_ID environment variable not configured',
          message: 'Please set ADMIN_USER_ID environment variable',
        },
        { status: 500 }
      );
    }

    const adminUser = await prisma.user.findUnique({
      where: { email: adminEmail },
      include: {
        userInterests: {
          orderBy: { weight: 'desc' },
          take: 20,
        },
        _count: {
          select: { articles: true },
        },
      },
    });

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Admin user not found',
          message: 'Please run: npx prisma db seed',
        },
        { status: 404 }
      );
    }

    // 管理者情報を返す
    const adminData = {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      profile: (adminUser.profile as any) || {},
      interests: (adminUser.interests as any) || {},
      userInterests: adminUser.userInterests.map((ui) => ({
        id: ui.id,
        keyword: ui.keyword,
        weight: ui.weight,
        lastUsed: ui.lastUsed.toISOString(),
      })),
      stats: {
        articlesCount: adminUser._count.articles,
        interestsCount: adminUser.userInterests.length,
      },
      createdAt: adminUser.createdAt.toISOString(),
      updatedAt: adminUser.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: adminData,
      message: 'Admin user found',
    });
  } catch (error) {
    console.error('Get admin user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get admin user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
