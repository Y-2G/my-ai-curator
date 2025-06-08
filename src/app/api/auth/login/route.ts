import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { verifyPassword } from '@/lib/security/password';

const prisma = new PrismaClient();

// ログインリクエストのスキーマ
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

import { env } from '@/lib/env';

const JWT_SECRET = env.JWT_SECRET || 'dev-jwt-secret-min-32-chars-long';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Processing login attempt
    
    // バリデーション
    const { email, password } = LoginSchema.parse(body);
    
    // ユーザーを検索
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        password: true,
        profile: true,
        interests: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      // User not found
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password',
      }, { status: 401 });
    }

    // パスワードチェック（ハッシュ化されたパスワードとの比較）
    const isPasswordValid = await verifyPassword(password, user.password || '');
    if (!isPasswordValid) {
      // Invalid password
      return NextResponse.json({
        success: false,
        error: 'Invalid email or password',
      }, { status: 401 });
    }

    // Login successful

    // JWTトークンの生成
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // レスポンスからパスワードを除外
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json({
      success: true,
      data: {
        user: userWithoutPassword,
        token,
      },
      message: 'Login successful',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request data',
        details: error.errors,
      }, { status: 400 });
    }

    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}