import { NextRequest } from 'next/server';
import { TagModel } from '@/lib/db/models/tag';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET(_request: NextRequest) {
  try {
    const tags = await TagModel.findAll();

    // レスポンスデータの整形
    const response = tags.map(tag => ({
      id: tag.id,
      name: tag.name,
      articleCount: tag._count.articleTags,
    }));

    return successResponse(response);
  } catch (error) {
    console.error('Tags API Error:', error);
    return errorResponse('タグの取得に失敗しました');
  }
}