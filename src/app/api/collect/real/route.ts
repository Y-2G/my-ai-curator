import { NextRequest, NextResponse } from 'next/server';
import { RssCollector } from '@/lib/collectors/rss-collector';
import { getActiveRSSSources, type RSSCategory } from '@/lib/config/rss-sources';

export async function POST(request: NextRequest) {
  try {
    const { query, category: _category, limit = 10 } = await request.json();

    // Processing real collection request

    const rssCollector = new RssCollector();
    
    // 実際のRSS収集を実行
    const results = await rssCollector.collect(query || 'React TypeScript', limit);

    return NextResponse.json({
      success: true,
      data: {
        results,
        sources: getActiveRSSSources().map(s => s.name),
        totalFound: results.length,
        query: query || 'React TypeScript',
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Real collection error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Real RSS collection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category') as RSSCategory | null;
    
    const sources = getActiveRSSSources();
    const filteredSources = category 
      ? sources.filter(s => s.category === category)
      : sources;

    return NextResponse.json({
      success: true,
      data: {
        availableSources: filteredSources,
        totalSources: sources.length,
        categories: [...new Set(sources.map(s => s.category))],
      },
    });

  } catch (error) {
    console.error('Sources API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get sources',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}