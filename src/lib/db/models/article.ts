import { prisma } from '@/lib/db/prisma';
import type { Article, Category, Source, Tag, Prisma } from '@prisma/client';

export interface ArticleWithRelations extends Article {
  category: Category | null;
  sources: Source[];
  articleTags: Array<{
    tag: Tag;
  }>;
}

export interface ArticleListParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  tagId?: string;
  sort?: 'createdAt' | 'interestScore' | 'qualityScore';
  order?: 'asc' | 'desc';
}

export class ArticleModel {
  static async findMany(params: ArticleListParams): Promise<{
    articles: ArticleWithRelations[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 20,
      categoryId,
      tagId,
      sort = 'createdAt',
      order = 'desc'
    } = params;


    const where: Prisma.ArticleWhereInput = {
      publishedAt: { not: null }
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (tagId) {
      where.articleTags = {
        some: { tagId }
      };
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          category: true,
          sources: true,
          articleTags: {
            include: { tag: true }
          }
        },
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.article.count({ where })
    ]);

    return {
      articles: articles as ArticleWithRelations[],
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  static async findById(id: string): Promise<ArticleWithRelations | null> {
    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        sources: true,
        articleTags: {
          include: { tag: true }
        }
      }
    });

    return article as ArticleWithRelations | null;
  }

  static async create(data: {
    title: string;
    summary: string;
    content: string;
    categoryId?: string;
    authorId?: string;
    sources: Array<{ url: string; title?: string; type: string }>;
    tags: string[];
    interestScore: number;
    qualityScore: number;
  }): Promise<ArticleWithRelations> {
    const { sources, tags, ...articleData } = data;

    return prisma.$transaction(async (tx) => {
      // 記事作成
      const article = await tx.article.create({
        data: {
          ...articleData,
          publishedAt: new Date()
        }
      });

      // ソース作成
      if (sources.length > 0) {
        await tx.source.createMany({
          data: sources.map(source => ({
            ...source,
            articleId: article.id
          }))
        });
      }

      // タグ処理
      if (tags.length > 0) {
        // 既存タグ取得または作成
        const tagRecords = await Promise.all(
          tags.map(async (tagName) => {
            return tx.tag.upsert({
              where: { name: tagName },
              update: {},
              create: { name: tagName }
            });
          })
        );

        // ArticleTag作成
        await tx.articleTag.createMany({
          data: tagRecords.map(tag => ({
            articleId: article.id,
            tagId: tag.id
          }))
        });
      }

      // 完全なデータを再取得
      const fullArticle = await tx.article.findUnique({
        where: { id: article.id },
        include: {
          category: true,
          sources: true,
          articleTags: {
            include: { tag: true }
          }
        }
      });

      return fullArticle as ArticleWithRelations;
    });
  }
}