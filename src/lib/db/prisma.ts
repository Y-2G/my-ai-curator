import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    ...(process.env.DATABASE_URL && {
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    }),
    // サーバーレス環境での最適化
    ...(process.env.NODE_ENV === 'production' && {
      // 本番環境でのログを最小化
      errorFormat: 'minimal',
    }),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;