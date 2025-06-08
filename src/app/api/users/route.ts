import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const prisma = new PrismaClient();

// ユーザー作成スキーマ
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  profile: z.object({
    techLevel: z.enum(['beginner', 'intermediate', 'advanced']).default('intermediate'),
    preferredStyle: z.enum(['technical', 'casual', 'balanced']).default('balanced'),
    bio: z.string().max(500).optional(),
  }).optional(),
  interests: z.object({
    categories: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
  }).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');
    
    if (email) {
      // メールアドレスで特定のユーザーを検索
      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          userInterests: {
            orderBy: { weight: 'desc' },
            take: 10,
          },
          _count: {
            select: { articles: true },
          },
        },
      });

      if (!user) {
        return NextResponse.json({
          success: false,
          error: 'User not found',
        }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          profile: user.profile,
          interests: user.interests,
          userInterests: user.userInterests.map(ui => ({
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
        },
      });
    }

    // すべてのユーザーを取得（管理用）
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        _count: {
          select: { articles: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: users.map(user => ({
        id: user.id,
        email: user.email,
        name: user.name,
        articlesCount: user._count.articles,
        createdAt: user.createdAt.toISOString(),
      })),
    });

  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to get users',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateUserSchema.parse(body);
    
    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: 'User with this email already exists',
      }, { status: 400 });
    }

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        name: validatedData.name,
        profile: validatedData.profile || {
          techLevel: 'intermediate',
          preferredStyle: 'balanced',
        },
        interests: validatedData.interests || {
          categories: [],
          tags: [],
          keywords: [],
        },
      },
    });

    // UserInterestの作成（キーワードがある場合）
    if (validatedData.interests?.keywords && validatedData.interests.keywords.length > 0) {
      await prisma.userInterest.createMany({
        data: validatedData.interests.keywords.map(keyword => ({
          userId: user.id,
          keyword,
          weight: 1.0,
        })),
      });
    }

    // 作成したユーザー情報を取得
    const createdUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userInterests: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: createdUser!.id,
        email: createdUser!.email,
        name: createdUser!.name,
        profile: createdUser!.profile,
        interests: createdUser!.interests,
        userInterests: createdUser!.userInterests.map(ui => ({
          id: ui.id,
          keyword: ui.keyword,
          weight: ui.weight,
          lastUsed: ui.lastUsed.toISOString(),
        })),
        createdAt: createdUser!.createdAt.toISOString(),
      },
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      }, { status: 400 });
    }

    console.error('Create user error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create user',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}