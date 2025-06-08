import { prisma } from '@/lib/db/prisma';
import type { Tag } from '@prisma/client';

export interface TagWithCount extends Tag {
  _count: {
    articleTags: number;
  };
}

export class TagModel {
  static async findAll(): Promise<TagWithCount[]> {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: { articleTags: true }
        }
      },
      orderBy: [
        { articleTags: { _count: 'desc' } },
        { name: 'asc' }
      ],
      take: 50 // 上位50タグまで
    });

    return tags;
  }

  static async findPopular(limit: number = 10): Promise<TagWithCount[]> {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: { articleTags: true }
        }
      },
      orderBy: {
        articleTags: { _count: 'desc' }
      },
      take: limit
    });

    return tags;
  }

  static async findByName(name: string): Promise<Tag | null> {
    return prisma.tag.findUnique({
      where: { name }
    });
  }
}