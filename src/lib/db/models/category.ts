import { prisma } from '@/lib/db/prisma';
import type { Category } from '@prisma/client';
export interface CategoryWithCount extends Category {
  _count: {
    articles: number;
  };
}

export class CategoryModel {
  static async findAll(): Promise<CategoryWithCount[]> {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { articles: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories;
  }

  static async findManyWithCount(): Promise<CategoryWithCount[]> {
    return this.findAll();
  }

  static async findAllWithArticles(): Promise<CategoryWithCount[]> {
    const categories = await prisma.category.findMany({
      include: {
        _count: {
          select: { articles: true },
        },
      },
      where: {
        articles: {
          some: {},
        },
      },
      orderBy: { name: 'asc' },
    });

    return categories;
  }

  static async findById(id: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { id },
    });
  }

  static async findByName(name: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { name },
    });
  }
}
