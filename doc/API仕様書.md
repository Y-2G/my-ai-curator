# API仕様書

## 概要

My AI Curator APIは、記事、カテゴリ、タグの情報を提供するRESTful APIです。

## ベースURL

```
開発環境: http://localhost:3000/api
本番環境: https://your-domain.com/api
```

## エンドポイント一覧

### 記事 (Articles)

#### GET /api/articles

記事一覧を取得します。

**クエリパラメータ:**
- `page` (number, optional): ページ番号 (デフォルト: 1)
- `limit` (number, optional): 1ページあたりの件数 (デフォルト: 20, 最大: 100)
- `category` (string, optional): カテゴリID (UUID)
- `tag` (string, optional): タグID (UUID)
- `sort` (string, optional): ソート項目 (`createdAt`, `interestScore`, `qualityScore`)
- `order` (string, optional): ソート順 (`asc`, `desc`)

**レスポンス例:**
```json
{
  "data": [
    {
      "id": "1",
      "title": "Next.js 15の新機能：Turbopackによる開発体験の向上",
      "summary": "Next.js 15がリリースされ、Turbopackが安定版として利用可能になりました。",
      "category": {
        "id": "3",
        "name": "Web開発",
        "color": "#10B981"
      },
      "tags": [
        { "id": "3", "name": "Next.js" },
        { "id": "1", "name": "TypeScript" }
      ],
      "interestScore": 9,
      "qualityScore": 8,
      "publishedAt": "2024-06-01T00:00:00.000Z",
      "createdAt": "2024-06-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

#### GET /api/articles/[id]

指定されたIDの記事詳細を取得します。

**パラメータ:**
- `id` (string): 記事ID

**レスポンス例:**
```json
{
  "data": {
    "id": "1",
    "title": "Next.js 15の新機能：Turbopackによる開発体験の向上",
    "summary": "Next.js 15がリリースされ、Turbopackが安定版として利用可能になりました。",
    "content": "# Next.js 15の新機能\n\nNext.js 15では、以下の主要な改善が行われました...",
    "category": {
      "id": "3",
      "name": "Web開発",
      "description": "フロントエンド、バックエンド、フルスタック開発",
      "color": "#10B981"
    },
    "tags": [
      { "id": "3", "name": "Next.js" },
      { "id": "1", "name": "TypeScript" }
    ],
    "sources": [
      {
        "id": "s1",
        "url": "https://nextjs.org/blog/next-15",
        "title": "Next.js 15",
        "type": "news"
      }
    ],
    "interestScore": 9,
    "qualityScore": 8,
    "publishedAt": "2024-06-01T00:00:00.000Z",
    "createdAt": "2024-06-01T00:00:00.000Z",
    "updatedAt": "2024-06-01T00:00:00.000Z"
  }
}
```

### カテゴリ (Categories)

#### GET /api/categories

カテゴリ一覧を取得します。

**レスポンス例:**
```json
{
  "data": [
    {
      "id": "1",
      "name": "プログラミング",
      "description": "プログラミング言語、フレームワーク、開発手法に関する記事",
      "color": "#3B82F6",
      "articleCount": 5
    },
    {
      "id": "2",
      "name": "AI・機械学習",
      "description": "AI、機械学習、深層学習に関する最新技術と応用",
      "color": "#8B5CF6",
      "articleCount": 3
    }
  ]
}
```

### タグ (Tags)

#### GET /api/tags

タグ一覧を取得します（記事数の多い順、最大50件）。

**レスポンス例:**
```json
{
  "data": [
    {
      "id": "1",
      "name": "TypeScript",
      "articleCount": 10
    },
    {
      "id": "2",
      "name": "React",
      "articleCount": 8
    }
  ]
}
```

## エラーレスポンス

エラーが発生した場合、以下の形式でレスポンスが返されます。

```json
{
  "error": "エラーメッセージ"
}
```

**HTTPステータスコード:**
- `400 Bad Request`: リクエストパラメータが不正
- `404 Not Found`: リソースが見つからない
- `500 Internal Server Error`: サーバー内部エラー

## 認証

現在のバージョンでは、公開APIに認証は必要ありません。

内部API（`/api/internal/*`）へのアクセスには、`x-api-key`ヘッダーによる認証が必要です。

## レート制限

現在のバージョンでは、レート制限は実装されていません。

## 開発者向け情報

### モックデータモード

データベース接続がない開発環境では、自動的にモックデータが使用されます。

### APIテストページ

開発環境では、`http://localhost:3000/api-test`でAPIの動作を確認できます。