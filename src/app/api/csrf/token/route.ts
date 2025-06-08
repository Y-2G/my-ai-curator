import { NextRequest, NextResponse } from 'next/server';
import { generateCSRFToken } from '@/lib/security/csrf';

export async function GET(_request: NextRequest) {
  try {
    const token = generateCSRFToken();
    
    const response = NextResponse.json({
      success: true,
      token,
    });

    // CSRFトークンをHttpOnlyクッキーとして設定
    response.cookies.set('csrf-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 24時間
    });

    return response;
  } catch (error) {
    console.error('CSRF token generation failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate CSRF token',
    }, { status: 500 });
  }
}