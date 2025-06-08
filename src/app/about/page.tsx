import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';

export const metadata: Metadata = {
  title: 'このサイトについて',
  description: 'My AI Curatorについて',
};

export default function AboutPage() {
  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">My AI Curatorについて</h1>

      <Card className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">概要</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          My AI Curatorは、私の興味に基づいてAIが記事を検索・紹介する
          個人的なキュレーションブログです。
        </p>
        <p className="text-gray-600 dark:text-gray-400">
          見つけた記事を個別に紹介し、同じような興味を持つ方との情報共有を目的としています。
        </p>
      </Card>

      <Card className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">主な機能</h2>
        <ul className="space-y-3 text-gray-600 dark:text-gray-400">
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
            <span>AIによる記事検索：私の興味に合わせて最新の記事を自動で発見</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
            <span>個別記事紹介：各記事をタイトル・リンク・要約付きで個別に紹介</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
            <span>興味度スコアリング：私の関心に基づく記事の優先度付け</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
            <span>自動カテゴリ分類：分野別への自動分類・整理</span>
          </li>
          <li className="flex items-start">
            <span className="text-blue-600 dark:text-blue-400 mr-2">✓</span>
            <span>パーソナルキュレーション：個人的な興味・関心に基づいた記事選定</span>
          </li>
        </ul>
      </Card>

      <Card className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">技術スタック</h2>
        <div className="grid md:grid-cols-2 gap-6 text-gray-600 dark:text-gray-400">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">フロントエンド</h3>
            <ul className="space-y-1">
              <li>• Next.js 15 (App Router)</li>
              <li>• TypeScript</li>
              <li>• Tailwind CSS</li>
              <li>• React 19</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">バックエンド</h3>
            <ul className="space-y-1">
              <li>• PostgreSQL + Prisma ORM</li>
              <li>• OpenAI GPT-4o</li>
              <li>• Vercel Functions</li>
              <li>• Vercel Cron Jobs</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
