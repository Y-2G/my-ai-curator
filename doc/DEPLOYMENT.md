# 🚀 My AI Curator デプロイメントガイド

このガイドでは、My AI CuratorをVercelにデプロイする手順を説明します。

## 📋 前提条件

- GitHubアカウント
- Vercelアカウント（GitHubでサインイン可能）
- PostgreSQLデータベース（Vercel Postgres推奨）
- 各種APIキー

## 🔧 デプロイ手順

### 1. GitHubリポジトリの準備

```bash
# リポジトリの初期化（まだの場合）
git init
git add .
git commit -m "Initial commit"

# GitHubで新しいリポジトリを作成後
git remote add origin https://github.com/YOUR_USERNAME/smart-curator.git
git branch -M main
git push -u origin main
```

### 2. 必要なAPIキーの取得

#### OpenAI API Key

1. [OpenAI Platform](https://platform.openai.com/)にアクセス
2. API Keys セクションで新しいキーを作成
3. `sk-` で始まるキーをコピー

#### Google Custom Search API

1. [Google Cloud Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. Custom Search APIを有効化
4. 認証情報でAPIキーを作成
5. [Programmable Search Engine](https://programmablesearchengine.google.com/)で検索エンジンIDを取得

#### その他のAPI（オプション）

- News API: [newsapi.org](https://newsapi.org/)
- Reddit API: [Reddit Apps](https://www.reddit.com/prefs/apps)
- GitHub Token: [GitHub Settings](https://github.com/settings/tokens)

### 3. Vercelでのデプロイ

#### 3.1 Vercelにログイン

1. [Vercel](https://vercel.com/)にアクセス
2. GitHubアカウントでログイン

#### 3.2 新規プロジェクト作成

1. "New Project"をクリック
2. GitHubリポジトリをインポート
3. "smart-curator"を選択

#### 3.3 環境変数の設定

Vercelのプロジェクト設定で以下の環境変数を追加：

```bash
# データベース（Vercel Postgresを使用する場合は自動設定）
POSTGRES_URL="postgresql://..."
POSTGRES_URL_NON_POOLING="postgresql://..."

# OpenAI（必須）
OPENAI_API_KEY="sk-..."

# Google Search（推奨）
GOOGLE_CUSTOM_SEARCH_API_KEY="AIza..."
GOOGLE_SEARCH_ENGINE_ID="..."

# セキュリティ（必須）
JWT_SECRET="your-super-secure-jwt-secret-minimum-32-characters"
NEXTAUTH_SECRET="your-nextauth-secret-minimum-32-characters"
INTERNAL_API_KEY="your-internal-api-key-minimum-32-characters"
CRON_SECRET="your-cron-secret-minimum-32-characters"

# アプリケーション
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
NODE_ENV="production"

# 管理者設定
ADMIN_USER_ID="your-admin-user-id"  # 初回は空でOK、後で更新

# セキュリティ設定
ALLOWED_ORIGINS="https://your-app.vercel.app"
RATE_LIMIT_ENABLED="true"

# その他のAPI（オプション）
NEWS_API_KEY="..."
REDDIT_CLIENT_ID="..."
REDDIT_CLIENT_SECRET="..."
GITHUB_TOKEN="..."
```

#### 3.4 Vercel Postgresのセットアップ

1. Vercelダッシュボードで"Storage"タブを選択
2. "Create Database" → "Postgres"を選択
3. データベース名を入力（例：smart-curator-db）
4. 作成後、環境変数が自動的に追加される

#### 3.5 デプロイ実行

1. すべての環境変数を設定後、"Deploy"をクリック
2. ビルドログを確認（約3-5分）
3. デプロイ完了後、URLが発行される

### 4. デプロイ後の初期設定

#### 4.1 データベースのマイグレーション

```bash
# ローカルで実行
npm install
npx prisma generate
npx prisma db push --accept-data-loss

# または、Vercelのターミナルから実行
```

#### 4.2 初期データの投入

```bash
# シードデータの投入
npx tsx prisma/seed.ts
```

#### 4.3 管理者アカウントの作成

1. デプロイされたアプリにアクセス
2. `/login`で管理者アカウントでログイン
   - Email: `2g.4423@gmail.com`
   - Password: `test`（すぐに変更してください）

#### 4.4 環境変数の更新

1. 管理者ユーザーのIDを確認
2. Vercelの環境変数で`ADMIN_USER_ID`を更新

### 5. Cronジョブの設定

`vercel.json`のcron設定が自動的に適用されます：

```json
{
  "crons": [
    {
      "path": "/api/cron/daily-articles",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- UTCタイムゾーンで動作
- 日本時間の設定例：
  - `"0 0 * * *"` → 日本時間 9:00
  - `"0 15 * * *"` → 日本時間 0:00

### 6. 動作確認

#### 基本機能の確認

- [ ] トップページが表示される
- [ ] 記事一覧が表示される
- [ ] カテゴリ一覧が表示される
- [ ] 管理者ログインができる

#### 管理機能の確認

- [ ] プロファイル更新ができる
- [ ] 単発記事生成が動作する
- [ ] バッチ記事生成が動作する

#### セキュリティの確認

- [ ] 未認証で管理ページにアクセスできない
- [ ] APIのレート制限が動作する
- [ ] セキュリティヘッダーが設定されている

## 🔧 トラブルシューティング

### ビルドエラーが発生する場合

```bash
# ローカルでビルドテスト
npm run build
```

### データベース接続エラー

1. Vercel Postgresの接続文字列を確認
2. IPアドレス制限を確認（Vercelは動的IP）

### API呼び出しエラー

1. 環境変数が正しく設定されているか確認
2. APIキーの有効性を確認
3. Vercelのログでエラー詳細を確認

### Cronジョブが動作しない

1. Vercelのログで実行履歴を確認
2. `CRON_SECRET`が正しく設定されているか確認
3. タイムゾーンの設定を確認

## 📱 カスタムドメインの設定

1. Vercelプロジェクトの"Settings" → "Domains"
2. カスタムドメインを追加
3. DNSレコードを設定：
   ```
   Type: CNAME
   Name: www (またはサブドメイン)
   Value: cname.vercel-dns.com
   ```

## 🔄 継続的デプロイ

GitHubにpushすると自動的にデプロイされます：

```bash
git add .
git commit -m "Update features"
git push origin main
```

- `main`ブランチ → 本番環境
- その他のブランチ → プレビュー環境

## 📊 監視とメンテナンス

### Vercelダッシュボード

- Functions: API呼び出し状況
- Analytics: アクセス解析
- Logs: エラーログ確認

### 定期メンテナンス

1. 依存関係の更新

   ```bash
   npm update
   npm audit fix
   ```

2. データベースの最適化

   - 古い記事のアーカイブ
   - インデックスの確認

3. APIキーのローテーション
   - 3ヶ月ごとに更新推奨

## 🎉 デプロイ完了！

以上でMy AI Curatorのデプロイが完了です。
問題が発生した場合は、Vercelのログを確認してください。

---

## 📚 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)
