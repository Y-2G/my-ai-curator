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

    console.log('PUT /api/users/[id] - Request received:', {
      userId: id,
      body,
      timestamp: new Date().toISOString(),
    });

    // バリデーション
    const validatedData = UpdateUserSchema.parse(body);
    console.log('Validation successful:', validatedData);

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

    // トランザクションで一括更新
    const userData = await prisma.$transaction(async (tx) => {
      console.log('Starting user update transaction for:', id);
      console.log('Update data:', validatedData);

      // ユーザー情報の更新
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          ...(validatedData.name && { name: validatedData.name }),
          ...(validatedData.profile && { profile: validatedData.profile }),
          ...(validatedData.interests && { interests: validatedData.interests }),
        },
      });
      
      console.log('User updated:', updatedUser.updatedAt);

      // UserInterestの更新（キーワードがある場合）
      if (validatedData.interests?.keywords) {
        console.log('Updating keywords:', validatedData.interests.keywords);
        
        // 既存のUserInterestを取得
        const existingInterests = await tx.userInterest.findMany({
          where: { userId: id },
        });

        const existingKeywords = existingInterests.map((ui) => ui.keyword);
        const newKeywords = validatedData.interests.keywords.filter(
          (keyword) => !existingKeywords.includes(keyword)
        );

        console.log('Existing keywords:', existingKeywords);
        console.log('New keywords to add:', newKeywords);

        // 新しいキーワードを追加
        if (newKeywords.length > 0) {
          await tx.userInterest.createMany({
            data: newKeywords.map((keyword) => ({
              userId: id,
              keyword,
              weight: 1.0,
            })),
          });
          console.log('Added new keywords:', newKeywords);
        }

        // 削除されたキーワードを削除
        const deletedKeywords = existingKeywords.filter(
          (keyword) => !validatedData.interests!.keywords!.includes(keyword)
        );

        console.log('Keywords to delete:', deletedKeywords);

        if (deletedKeywords.length > 0) {
          await tx.userInterest.deleteMany({
            where: {
              userId: id,
              keyword: { in: deletedKeywords },
            },
          });
          console.log('Deleted keywords:', deletedKeywords);
        }
      }

      // 更新後のユーザー情報を取得
      const finalUserData = await tx.user.findUnique({
        where: { id },
        include: {
          userInterests: {
            orderBy: { weight: 'desc' },
            take: 20,
          },
        },
      });

      console.log('Transaction completed, final user data:', {
        id: finalUserData?.id,
        name: finalUserData?.name,
        interests: finalUserData?.interests,
        userInterestsCount: finalUserData?.userInterests.length,
      });

      return finalUserData;
    }, {
      timeout: 10000, // 10秒にタイムアウトを延長
    });

    if (!userData) {
      console.error('Transaction completed but userData is null');
      throw new Error('Failed to retrieve updated user data');
    }

    const responseData = {
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
    };

    console.log('PUT /api/users/[id] - Sending response:', {
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'User updated successfully',
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

    console.error('PUT /api/users/[id] - Update user error:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      userId: await context.params.then(p => p.id),
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : 'Unknown error',
        debug: process.env.NODE_ENV === 'development' ? {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
        } : undefined,
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
