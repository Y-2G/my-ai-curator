import { NextRequest, NextResponse } from 'next/server';
import { ArticlePipeline } from '@/lib/ai/services/article-pipeline';
import type { UserProfile } from '@/lib/ai/types';
import type { RawContentData } from '@/lib/types';

// ランタイム設定
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sources,
      userProfile,
      options = {},
      mode = 'single', // 'single' | 'batch'
    } = body;

    // バリデーション
    if (!sources || !Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Sources array is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!userProfile || !userProfile.id) {
      return NextResponse.json(
        { success: false, error: 'Valid user profile is required' },
        { status: 400 }
      );
    }

    const pipeline = new ArticlePipeline();

    if (mode === 'single') {
      // 単一記事生成
      const result = await pipeline.generateArticle(
        sources as RawContentData[],
        userProfile as UserProfile,
        options
      );

      return NextResponse.json({
        success: result.success,
        data: result.success
          ? {
              article: result.article,
              metadata: result.metadata,
              warnings: result.warnings,
            }
          : null,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    } else if (mode === 'batch') {
      // バッチ記事生成
      if (!Array.isArray(sources[0])) {
        return NextResponse.json(
          { success: false, error: 'Batch mode requires array of source arrays' },
          { status: 400 }
        );
      }

      const result = await pipeline.generateArticlesBatch(
        sources as RawContentData[][],
        userProfile as UserProfile,
        options
      );

      return NextResponse.json({
        success: result.successful.length > 0,
        data: {
          successful: result.successful,
          failed: result.failed,
          summary: result.summary,
        },
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid mode. Use "single" or "batch"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Article generation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate article',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action') || 'test';

    const pipeline = new ArticlePipeline();

    switch (action) {
      case 'test':
        return await testArticleGeneration();

      case 'diagnose':
        const diagnosis = await pipeline.diagnosePipeline();
        return NextResponse.json({
          success: true,
          data: diagnosis,
          timestamp: new Date().toISOString(),
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: test, diagnose' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Article generation API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'API request failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

async function testArticleGeneration() {
  const pipeline = new ArticlePipeline();

  // テスト用データ
  const testSources: RawContentData[] = [
    {
      title: 'React 19の新機能を詳しく解説',
      url: 'https://example.com/react-19-features',
      summary:
        'React 19で導入される新しい機能について詳しく解説します。Server Components、Concurrent Rendering、そして新しいHooks APIについて説明します。',
      publishedAt: new Date().toISOString(),
      source: 'React Blog',
      type: 'tutorial',
      metadata: {
        author: 'React Team',
        readTime: '10 min',
      },
    },
    {
      title: 'TypeScriptでのReact開発のベストプラクティス',
      url: 'https://example.com/typescript-react-best-practices',
      summary:
        'TypeScriptとReactを組み合わせた開発における最新のベストプラクティスを紹介。型安全性の向上から、パフォーマンス最適化まで幅広くカバーします。',
      publishedAt: new Date(Date.now() - 86400000).toISOString(), // 1日前
      source: 'TypeScript Handbook',
      type: 'guide',
      metadata: {
        author: 'TypeScript Team',
        tags: ['typescript', 'react', 'best-practices'],
      },
    },
    {
      title: 'Next.js 15の新機能とアップグレードガイド',
      url: 'https://example.com/nextjs-15-upgrade',
      summary:
        'Next.js 15の新機能紹介とv14からのアップグレード手順。Turbopackの改善、新しいAPI Routes、そしてパフォーマンス向上について説明します。',
      publishedAt: new Date(Date.now() - 172800000).toISOString(), // 2日前
      source: 'Next.js Blog',
      type: 'news',
      metadata: {
        author: 'Vercel Team',
        version: '15.0.0',
      },
    },
  ];

  const testUserProfile: UserProfile = {
    id: 'test-user',
    interests: ['React', 'TypeScript', 'Next.js', 'Frontend Development'],
    techLevel: 'intermediate',
    preferredTopics: ['react', 'typescript', 'web development'],
    recentActivity: ['React tutorial', 'TypeScript guide', 'Next.js documentation'],
    languagePreference: 'ja',
    contentTypes: ['tutorial', 'guide', 'news'],
  };

  const result = await pipeline.generateArticle(testSources, testUserProfile, {
    qualityThreshold: 6,
    interestThreshold: 5,
    targetLength: 'medium',
    style: 'tutorial',
    maxSourcesPerArticle: 3,
  });

  return NextResponse.json({
    success: true,
    service: 'Article Generation Test',
    data: {
      ...result,
      testData: {
        sourcesProvided: testSources.length,
        userProfile: {
          interests: testUserProfile.interests,
          techLevel: testUserProfile.techLevel,
        },
      },
    },
    timestamp: new Date().toISOString(),
  });
}
