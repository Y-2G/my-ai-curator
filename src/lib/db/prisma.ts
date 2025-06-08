import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // サーバーレス環境での最適化
    ...(process.env.NODE_ENV === 'production' && {
      datasourceUrl: process.env.DATABASE_URL,
    }),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;