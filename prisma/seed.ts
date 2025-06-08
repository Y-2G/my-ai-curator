import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/lib/security/password';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // カテゴリの作成
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'プログラミング' },
      update: {},
      create: {
        name: 'プログラミング',
        description: 'プログラミング言語、フレームワーク、開発手法に関する記事',
        color: '#3B82F6',
      },
    }),
    prisma.category.upsert({
      where: { name: 'AI・機械学習' },
      update: {},
      create: {
        name: 'AI・機械学習',
        description: 'AI、機械学習、深層学習に関する最新技術と応用',
        color: '#8B5CF6',
      },
    }),
    prisma.category.upsert({
      where: { name: 'Web開発' },
      update: {},
      create: {
        name: 'Web開発',
        description: 'フロントエンド、バックエンド、フルスタック開発',
        color: '#10B981',
      },
    }),
    prisma.category.upsert({
      where: { name: 'DevOps' },
      update: {},
      create: {
        name: 'DevOps',
        description: 'CI/CD、インフラ、クラウド、コンテナ技術',
        color: '#F59E0B',
      },
    }),
    prisma.category.upsert({
      where: { name: 'セキュリティ' },
      update: {},
      create: {
        name: 'セキュリティ',
        description: 'サイバーセキュリティ、脆弱性、暗号化技術',
        color: '#EF4444',
      },
    }),
  ]);

  console.log(`✅ Created ${categories.length} categories`);

  // タグの作成
  const tagNames = [
    'TypeScript',
    'React',
    'Next.js',
    'Node.js',
    'Python',
    'Docker',
    'Kubernetes',
    'AWS',
    'GitHub',
    'VSCode',
    'ChatGPT',
    'LLM',
    'Database',
    'PostgreSQL',
    'REST API',
    'GraphQL',
    'Testing',
    'Performance',
    'Security',
    'Open Source',
  ];

  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    )
  );

  console.log(`✅ Created ${tags.length} tags`);

  // 管理者ユーザーの作成
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error(
      'ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required for seeding'
    );
  }

  const hashedPassword = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword },
    create: {
      email: adminEmail,
      name: 'My AI Curator Admin',
      password: hashedPassword,
      profile: {
        techLevel: 'advanced',
        preferredStyle: 'balanced',
        bio: 'My AI Curatorの管理者アカウント',
      },
      interests: {
        categories: ['プログラミング', 'AI・機械学習', 'Web開発', 'DevOps'],
        tags: ['React', 'TypeScript', 'Next.js', 'Node.js', 'AI', 'ChatGPT'],
        keywords: ['Next.js', 'React', 'TypeScript', 'AI', 'OpenAI', 'Web開発'],
      },
    },
  });

  console.log('✅ Created admin user');

  // ユーザーの興味キーワード
  const interestKeywords = [
    { keyword: 'Next.js', weight: 0.9 },
    { keyword: 'TypeScript', weight: 0.85 },
    { keyword: 'AI', weight: 0.8 },
    { keyword: 'React', weight: 0.75 },
    { keyword: 'Node.js', weight: 0.7 },
  ];

  await Promise.all(
    interestKeywords.map((interest) =>
      prisma.userInterest.upsert({
        where: {
          userId_keyword: {
            userId: adminUser.id,
            keyword: interest.keyword,
          },
        },
        update: { weight: interest.weight },
        create: {
          userId: adminUser.id,
          ...interest,
        },
      })
    )
  );

  console.log('✅ Created user interests');

  // サンプル記事の作成
  const sampleArticles = [
    {
      title: 'Next.js 15の新機能：Turbopackによる開発体験の向上',
      summary:
        'Next.js 15がリリースされ、Turbopackが安定版として利用可能になりました。ビルド時間が大幅に短縮され、開発体験が向上しています。',
      content: `# Next.js 15の新機能

Next.js 15では、以下の主要な改善が行われました：

## Turbopackの安定化
- 開発サーバーの起動が最大10倍高速化
- HMR（Hot Module Replacement）の改善
- メモリ使用量の削減

## その他の改善点
- App Routerのパフォーマンス向上
- React 19のサポート
- 改善されたエラーハンドリング

これらの改善により、大規模なアプリケーションでも快適な開発が可能になりました。`,
      categoryId: categories[2].id, // Web開発
      interestScore: 9,
      qualityScore: 8,
      tags: ['Next.js', 'React', 'TypeScript'],
      sources: [
        {
          url: 'https://nextjs.org/blog/next-15',
          title: 'Next.js 15',
          type: 'news',
        },
      ],
    },
    {
      title: 'GPT-4oの実践的な活用方法：コード生成からデバッグまで',
      summary:
        'GPT-4oを使用した効率的なプログラミング手法を紹介。コード生成、リファクタリング、デバッグなど、実践的な活用例を解説します。',
      content: `# GPT-4oの実践的な活用方法

## 1. コード生成
GPT-4oは複雑なコードも理解し、適切な実装を提案できます。

## 2. デバッグ支援
エラーメッセージを入力することで、原因と解決策を提示してくれます。

## 3. リファクタリング
既存のコードをより効率的で読みやすいコードに改善する提案が可能です。

## 4. ドキュメント作成
コードからドキュメントを自動生成することができます。`,
      categoryId: categories[1].id, // AI・機械学習
      interestScore: 8,
      qualityScore: 9,
      tags: ['ChatGPT', 'AI', 'LLM'],
      sources: [
        {
          url: 'https://openai.com/blog/gpt-4o',
          title: 'GPT-4o',
          type: 'news',
        },
      ],
    },
  ];

  // 記事とその関連データを作成
  for (const articleData of sampleArticles) {
    const { tags: tagNames, sources, ...article } = articleData;

    // 記事を作成
    const createdArticle = await prisma.article.create({
      data: {
        ...article,
        authorId: adminUser.id,
        publishedAt: new Date(),
      },
    });

    // ソースを作成
    await prisma.source.createMany({
      data: sources.map((source) => ({
        ...source,
        articleId: createdArticle.id,
      })),
    });

    // タグを関連付け
    const articleTags = tags.filter((tag) => tagNames.includes(tag.name));
    await prisma.articleTag.createMany({
      data: articleTags.map((tag) => ({
        articleId: createdArticle.id,
        tagId: tag.id,
      })),
    });
  }

  console.log(`✅ Created ${sampleArticles.length} sample articles`);

  // コレクションジョブのサンプル
  await prisma.collectionJob.create({
    data: {
      status: 'completed',
      startedAt: new Date(Date.now() - 3600000), // 1時間前
      completedAt: new Date(Date.now() - 3000000), // 50分前
      articlesCreated: 2,
      metadata: {
        sources: ['news', 'reddit'],
        duration: '10 minutes',
      },
    },
  });

  console.log('✅ Created sample collection job');
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
