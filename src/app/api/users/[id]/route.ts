import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// ユーザープロファイルの更新スキーマ
const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  profile: z
    .object({
      techLevel: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
      preferredStyle: z.enum(['technical', 'casual', 'balanced']).optional(),
      bio: z.string().max(500).optional(),
    })
    .optional(),
  interests: z
    .object({
      categories: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
      keywords: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    const user = await prisma.user.findUnique({
      where: { id },
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

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // プロファイルデータの整形
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      profile: (user.profile as any) || {},
      interests: (user.interests as any) || {},
      userInterests: user.userInterests.map((ui) => ({
        id: ui.id,
        keyword: ui.keyword,
        weight: ui.weight,
        lastUsed: ui.lastUsed.toISOString(),
      })),
      stats: {
        articlesCount: user._count.articles,
        interestsCount: user.userInterests.length,
      },
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    // Processing user update request

    // バリデーション
    const validatedData = UpdateUserSchema.parse(body);
    // Data validation successful

    // ユーザーの存在確認
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    // User existence check completed

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          debug: { id },
        },
        { status: 404 }
      );
    }

    // User updated successfully

    // UserInterestの更新（キーワードがある場合）
    if (validatedData.interests?.keywords) {
      // 既存のUserInterestを取得
      const existingInterests = await prisma.userInterest.findMany({
        where: { userId: id },
      });

      const existingKeywords = existingInterests.map((ui) => ui.keyword);
      const newKeywords = validatedData.interests.keywords.filter(
        (keyword) => !existingKeywords.includes(keyword)
      );

      // 新しいキーワードを追加
      if (newKeywords.length > 0) {
        await prisma.userInterest.createMany({
          data: newKeywords.map((keyword) => ({
            userId: id,
            keyword,
            weight: 1.0,
          })),
        });
      }

      // 削除されたキーワードを削除
      const deletedKeywords = existingKeywords.filter(
        (keyword) => !validatedData.interests!.keywords!.includes(keyword)
      );

      if (deletedKeywords.length > 0) {
        await prisma.userInterest.deleteMany({
          where: {
            userId: id,
            keyword: { in: deletedKeywords },
          },
        });
      }
    }

    // 更新後のユーザー情報を取得
    const userData = await prisma.user.findUnique({
      where: { id },
      include: {
        userInterests: {
          orderBy: { weight: 'desc' },
          take: 20,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: userData!.id,
        email: userData!.email,
        name: userData!.name,
        profile: userData!.profile,
        interests: userData!.interests,
        userInterests: userData!.userInterests.map((ui) => ({
          id: ui.id,
          keyword: ui.keyword,
          weight: ui.weight,
          lastUsed: ui.lastUsed.toISOString(),
        })),
        updatedAt: userData!.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('PUT /api/users/[id] - Validation error:', error.errors);
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('PUT /api/users/[id] - Update user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user',
        message:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    // ユーザーの存在確認
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
        },
        { status: 404 }
      );
    }

    // ユーザーと関連データの削除（カスケード削除）
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete user',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
