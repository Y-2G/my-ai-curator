import { NextRequest } from 'next/server';
import { CategoryModel } from '@/lib/db/models/category';
import { successResponse, errorResponse } from '@/lib/api/response';

export async function GET(_request: NextRequest) {
  try {
    const categories = await CategoryModel.findAllWithArticles();

    // レスポンスデータの整形
    const response = categories.map(category => ({
      id: category.id,
      name: category.name,
      description: category.description,
      color: category.color,
      articleCount: category._count.articles,
    }));

    return successResponse(response);
  } catch (error) {
    console.error('Categories API Error:', error);
    return errorResponse('カテゴリの取得に失敗しました');
  }
}