import { prisma } from '../prisma';
import type { Article, Source, Tag, Category } from '@prisma/client';

export interface CreateArticleInput {
  title: string;
  summary: string;
  content: string;
  category?: string;
  tags: string[];
  sources: {
    title: string;
    url: string;
    type: string;
  }[];
  qualityScore?: number;
  interestScore?: number;
  publishedAt?: Date;
  metadata?: Record<string, any>;
}

export interface ArticleWithRelations extends Article {
  category: Category | null;
  sources: Source[];
  articleTags: Array<{
    tag: Tag;
  }>;
}

export class ArticleService {
  /**
   * 記事を作成・保存
   */
  async createArticle(input: CreateArticleInput): Promise<ArticleWithRelations> {
    const {
      title,
      summary,
      content,
      category,
      tags,
      sources,
      qualityScore = 0,
      interestScore = 0,
      publishedAt = new Date(),
      metadata: _metadata,
    } = input;

    return await prisma.$transaction(async (tx) => {
      console.log('Starting article creation transaction');
      const startTime = Date.now();
      
      // カテゴリの取得または作成
      let categoryRecord = null;
      if (category) {
        categoryRecord = await tx.category.upsert({
          where: { name: category },
          update: {},
          create: {
            name: category,
            description: `${category}に関する記事`,
            color: this.getCategoryColor(category),
          },
        });
      }

      // 記事の作成
      const article = await tx.article.create({
        data: {
          title,
          summary,
          content,
          categoryId: categoryRecord?.id,
          qualityScore,
          interestScore,
          publishedAt,
        },
      });

      // ソース作成とタグ処理を並列実行
      await Promise.all([
        // ソースの作成
        sources.length > 0 ? tx.source.createMany({
          data: sources.map((source) => ({
            articleId: article.id,
            title: source.title,
            url: source.url,
            type: source.type,
          })),
        }) : Promise.resolve(),
        
        // タグの作成・関連付け
        tags.length > 0 ? (async () => {
          // タグを作成または取得
          const tagRecords = await Promise.all(
            tags.map((tagName) =>
              tx.tag.upsert({
                where: { name: tagName },
                update: {},
                create: { name: tagName },
              })
            )
          );

          // 記事とタグの関連付け
          await tx.articleTag.createMany({
            data: tagRecords.map((tag) => ({
              articleId: article.id,
              tagId: tag.id,
            })),
          });
        })() : Promise.resolve(),
      ]);

      // 作成した記事を関連データと一緒に取得
      const result = await tx.article.findUniqueOrThrow({
        where: { id: article.id },
        include: {
          category: true,
          sources: true,
          articleTags: {
            include: {
              tag: true,
            },
          },
        },
      });
      
      const duration = Date.now() - startTime;
      console.log(`Article creation transaction completed in ${duration}ms`);
      
      return result;
    }, {
      timeout: 15000, // 15秒にタイムアウトを延長
    });
  }

  /**
   * 記事一覧を取得
   */
  async getArticles(
    options: {
      page?: number;
      limit?: number;
      category?: string;
      tag?: string;
      search?: string;
    } = {}
  ): Promise<{
    articles: ArticleWithRelations[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 10, category, tag, search } = options;

    const skip = (page - 1) * limit;

    // 検索条件の構築
    const where: any = {};

    if (category) {
      // カテゴリIDまたは名前で検索
      where.categoryId = category;
    }

    if (tag) {
      where.articleTags = {
        some: {
          tag: {
            name: tag,
          },
        },
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 記事とカウントを並行取得
    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          category: true,
          sources: true,
          articleTags: {
            include: {
              tag: true,
            },
          },
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      articles,
      total,
      page,
      totalPages,
    };
  }

  /**
   * 記事詳細を取得
   */
  async getArticleById(id: string): Promise<ArticleWithRelations | null> {
    return await prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        sources: true,
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
    });
  }

  /**
   * 最新記事を取得
   */
  async getLatestArticles(limit: number = 5): Promise<ArticleWithRelations[]> {
    return await prisma.article.findMany({
      include: {
        category: true,
        sources: true,
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * カテゴリ別記事を取得
   */
  async getArticlesByCategory(
    categoryName: string,
    limit: number = 10
  ): Promise<ArticleWithRelations[]> {
    return await prisma.article.findMany({
      where: {
        category: {
          name: categoryName,
        },
      },
      include: {
        category: true,
        sources: true,
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });
  }

  /**
   * 記事を更新
   */
  async updateArticle(
    id: string,
    input: Partial<CreateArticleInput>
  ): Promise<ArticleWithRelations | null> {
    const existingArticle = await prisma.article.findUnique({
      where: { id },
      include: {
        category: true,
        sources: true,
        articleTags: {
          include: {
            tag: true,
          },
        },
      },
    });

    if (!existingArticle) {
      return null;
    }

    return await prisma.$transaction(async (tx) => {
      const startTime = Date.now();
      
      const {
        title,
        summary,
        content,
        category,
        tags,
        sources,
        qualityScore,
        interestScore,
        publishedAt,
      } = input;

      // カテゴリの更新
      let categoryRecord = existingArticle.category;
      if (category !== undefined) {
        if (category) {
          categoryRecord = await tx.category.upsert({
            where: { name: category },
            update: {},
            create: {
              name: category,
              description: `${category}に関する記事`,
              color: this.getCategoryColor(category),
            },
          });
        } else {
          categoryRecord = null;
        }
      }

      // 記事の更新
      await tx.article.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(summary !== undefined && { summary }),
          ...(content !== undefined && { content }),
          ...(category !== undefined && { categoryId: categoryRecord?.id || null }),
          ...(qualityScore !== undefined && { qualityScore }),
          ...(interestScore !== undefined && { interestScore }),
          ...(publishedAt !== undefined && { publishedAt }),
        },
      });

      // ソースとタグの更新を並列実行
      const updatePromises: Promise<any>[] = [];

      // ソースの更新
      if (sources !== undefined) {
        updatePromises.push(
          (async () => {
            // 既存のソースを削除
            await tx.source.deleteMany({
              where: { articleId: id },
            });

            // 新しいソースを作成
            if (sources.length > 0) {
              await tx.source.createMany({
                data: sources.map((source) => ({
                  articleId: id,
                  title: source.title,
                  url: source.url,
                  type: source.type,
                })),
              });
            }
          })()
        );
      }

      // タグの更新
      if (tags !== undefined) {
        updatePromises.push(
          (async () => {
            // 既存のタグ関連を削除
            await tx.articleTag.deleteMany({
              where: { articleId: id },
            });

            // 新しいタグを作成・関連付け
            if (tags.length > 0) {
              const tagRecords = await Promise.all(
                tags.map((tagName) =>
                  tx.tag.upsert({
                    where: { name: tagName },
                    update: {},
                    create: { name: tagName },
                  })
                )
              );

              await tx.articleTag.createMany({
                data: tagRecords.map((tag) => ({
                  articleId: id,
                  tagId: tag.id,
                })),
              });
            }
          })()
        );
      }

      // 並列実行
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }

      // 更新された記事を関連データと一緒に取得
      const result = await tx.article.findUniqueOrThrow({
        where: { id },
        include: {
          category: true,
          sources: true,
          articleTags: {
            include: {
              tag: true,
            },
          },
        },
      });
      
      const duration = Date.now() - startTime;
      console.log(`Article update transaction completed in ${duration}ms`);
      
      return result;
    }, {
      timeout: 14000, // Prisma Accelerateの15秒制限内に収める（14秒）
    });
  }

  /**
   * 記事を削除
   */
  async deleteArticle(id: string): Promise<boolean> {
    const existingArticle = await prisma.article.findUnique({
      where: { id },
    });

    if (!existingArticle) {
      return false;
    }

    await prisma.$transaction(async (tx) => {
      // 関連データを並列で削除（パフォーマンス向上）
      await Promise.all([
        tx.source.deleteMany({
          where: { articleId: id },
        }),
        tx.articleTag.deleteMany({
          where: { articleId: id },
        }),
      ]);

      // 記事を削除
      await tx.article.delete({
        where: { id },
      });
    }, {
      timeout: 14000, // Prisma Accelerateの15秒制限内に収める（14秒）
    });

    return true;
  }

  /**
   * 統計情報を取得
   */
  async getStats(): Promise<{
    totalArticles: number;
    totalCategories: number;
    totalTags: number;
    recentArticles: number;
  }> {
    const [totalArticles, totalCategories, totalTags, recentArticles] = await Promise.all([
      prisma.article.count(),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.article.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 過去7日
          },
        },
      }),
    ]);

    return {
      totalArticles,
      totalCategories,
      totalTags,
      recentArticles,
    };
  }

  /**
   * カテゴリに基づく色を取得
   */
  private getCategoryColor(categoryName: string): string {
    const colorMap: Record<string, string> = {
      テクノロジー: '#3B82F6',
      AI: '#8B5CF6',
      React: '#06B6D4',
      TypeScript: '#0EA5E9',
      'Next.js': '#10B981',
      JavaScript: '#F59E0B',
      Web開発: '#EF4444',
      プログラミング: '#84CC16',
      ニュース: '#6366F1',
      ツール: '#F97316',
    };

    return colorMap[categoryName] || '#6B7280';
  }
}

export const articleService = new ArticleService();
