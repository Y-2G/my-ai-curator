# 🤖 My AI Curator

AI駆動の個人向けキュレーションブログシステム。私の興味に基づいて、AIが自動的に記事を検索・生成・紹介します。

## ✨ 概要

My AI Curatorは、個人の興味・関心に基づいてAIが自動的に情報を収集し、オリジナルのキュレーション記事を生成する次世代ブログシステムです。技術記事だけでなく、幅広い分野の情報をカバーします。

## 技術スタック

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4o
- **Deployment**: Vercel

## セットアップ

### 1. 環境構築

```bash
# リポジトリのクローン
git clone [repository-url]
cd smart-curator

# 依存関係のインストール
npm install
```

### 2. 環境変数の設定

```bash
# .env.localファイルを作成
cp .env.example .env.local
```

`.env.local`を編集して必要な環境変数を設定：

- `DATABASE_URL`: PostgreSQL接続URL
- `OPENAI_API_KEY`: OpenAI APIキー
- その他必要なAPIキー

### 3. データベースのセットアップ

#### Option A: Dockerを使用（推奨）

```bash
# PostgreSQLコンテナを起動
docker-compose up -d

# データベーススキーマを作成
npm run db:push

# シードデータを投入
npm run db:seed
```

#### Option B: ローカルPostgreSQL

```bash
# データベースを作成
createdb smart_curator

# データベーススキーマを作成
npm run db:push

# シードデータを投入
npm run db:seed
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアプリケーションにアクセスできます。

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番サーバー起動
npm run start

# コード整形
npm run format

# Lintチェック
npm run lint

# 型チェック
npm run typecheck

# データベース管理
npm run db:generate   # Prismaクライアント生成
npm run db:push      # スキーマをDBに反映
npm run db:migrate   # マイグレーション実行
npm run db:studio    # Prisma Studio起動
npm run db:seed      # シードデータ投入
```

## プロジェクト構造

```
smart-curator/
├── src/
│   ├── app/              # Next.js App Router
│   ├── components/       # Reactコンポーネント
│   ├── lib/              # ユーティリティ・ロジック
│   │   ├── api/          # APIクライアント
│   │   ├── db/           # データベース関連
│   │   ├── ai/           # AI処理
│   │   └── utils/        # ヘルパー関数
│   └── hooks/            # カスタムフック
├── prisma/               # Prismaスキーマ・マイグレーション
├── public/               # 静的ファイル
└── doc/                  # ドキュメント
```

## 🎯 主な機能

### AI機能

- 🔍 **インテリジェント検索**: GPT-4による高度な検索クエリ生成
- 📝 **自動記事生成**: 複数の情報源から記事を自動生成
- 🏷️ **自動分類**: カテゴリ・タグの自動判定
- 📊 **興味度スコアリング**: 個人の興味に基づく記事の優先度付け

### 管理機能

- 👤 **プロファイル管理**: 興味・関心の詳細設定
- 🔄 **バッチ処理**: 複数記事の一括生成
- 📅 **定期実行**: Vercel Cronによる自動更新
- 📈 **統計ダッシュボード**: 生成記事の分析

### セキュリティ

- 🔒 **JWT認証**: セキュアなユーザー認証
- 🛡️ **レート制限**: API保護
- 🔐 **入力検証**: XSS・SQLインジェクション対策
- 📋 **監査ログ**: セキュリティイベントの記録

## 🚀 デプロイ

詳細なデプロイ手順は [DEPLOYMENT.md](./doc/DEPLOYMENT.md) を参照してください。

### クイックデプロイ（Vercel）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fsmart-curator)

## 🔒 セキュリティ

セキュリティ設定と推奨事項については [SECURITY.md](./SECURITY.md) を参照してください。

## 📚 ドキュメント

- [デプロイメントガイド](./DEPLOYMENT.md)
- [セキュリティガイド](./SECURITY.md)
- [API仕様書](./doc/API仕様書.md)
- [基本設計](./doc/基本設計.md)

## 🤝 貢献

プルリクエストを歓迎します！大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。

## 📝 ライセンス

MIT License - 詳細は [LICENSE](./LICENSE) ファイルを参照してください。

---

Built with ❤️ using Next.js, TypeScript, Prisma, and AI
