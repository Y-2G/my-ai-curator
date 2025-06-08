# 🔒 My AI Curator セキュリティガイド

このドキュメントでは、My AI Curator アプリケーションのセキュリティ機能と設定について説明します。

## 📋 実装済みセキュリティ機能

### 1. 認証・認可システム

#### JWT ベース認証

- **場所**: `src/lib/security/auth-middleware.ts`
- **機能**: トークンベース認証、有効期限チェック、管理者権限制御
- **環境変数**: `JWT_SECRET` (最低32文字必須)

#### 保護されたAPIエンドポイント

- `/api/admin/*` - 管理者専用
- `/api/users/*` - 認証必須
- `/api/articles/generate` - 認証必須
- `/api/ai/*` - 認証必須

### 2. レート制限

#### API別制限設定

- **一般API**: 60リクエスト/分
- **認証API**: 10リクエスト/5分
- **AI生成API**: 20リクエスト/時間
- **管理者API**: 30リクエスト/分
- **検索API**: 100リクエスト/分

#### 実装

```typescript
// レート制限の適用例
import { rateLimiters } from '@/lib/security/rate-limiter';
const limitResult = rateLimiters.auth.apply(request);
```

### 3. 入力値検証・サニタイゼーション

#### Zodスキーマ検証

- **場所**: `src/lib/security/validation.ts`
- **機能**:
  - HTMLタグ除去
  - SQLインジェクション対策
  - XSS攻撃防止
  - 入力長制限

#### 使用例

```typescript
import { ArticleValidationSchema } from '@/lib/security/validation';
const validatedData = ArticleValidationSchema.parse(input);
```

### 4. セキュアロギング

#### 機密情報の自動マスク

- **場所**: `src/lib/security/logger.ts`
- **機能**:
  - JWT トークンマスク
  - メールアドレスマスク
  - API キーマスク
  - クレジットカード番号マスク

#### 使用例

```typescript
import { logger } from '@/lib/security/logger';
logger.security('UNAUTHORIZED_ACCESS', { userId, ip });
```

### 5. セキュリティヘッダー

#### 設定済みヘッダー

```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block
Content-Security-Policy: [環境別設定]
```

## 🚀 本番環境セットアップ

### 必須環境変数

```bash
# 認証・暗号化
JWT_SECRET="your-super-secure-jwt-secret-minimum-32-characters"
NEXTAUTH_SECRET="your-nextauth-secret-minimum-32-characters"
ENCRYPTION_KEY="your-encryption-key-minimum-32-characters"

# API セキュリティ
INTERNAL_API_KEY="your-internal-api-key-minimum-32-characters"
CRON_SECRET="your-cron-secret-minimum-32-characters"

# CORS設定
ALLOWED_ORIGINS="https://yourdomain.com,https://admin.yourdomain.com"

# レート制限
RATE_LIMIT_ENABLED="true"

# データベース
DATABASE_URL="postgresql://username:password@host:port/database"
DATABASE_URL_NON_POOLING="postgresql://username:password@host:port/database"

# 外部API
OPENAI_API_KEY="sk-your-openai-api-key"
```

### セキュリティ設定チェックリスト

#### 🔐 認証・認可

- [ ] JWT_SECRET が32文字以上
- [ ] 管理者アカウントの強固なパスワード設定
- [ ] 本番環境で開発用デフォルトシークレットを使用していない

#### 🛡️ API セキュリティ

- [ ] レート制限が有効
- [ ] 保護されたエンドポイントの認証チェック
- [ ] CORS設定が適切

#### 📝 ログ・監視

- [ ] 機密情報のマスク設定
- [ ] セキュリティイベントの監視
- [ ] エラーログの適切な設定

#### 🌐 ネットワークセキュリティ

- [ ] HTTPS強制設定
- [ ] セキュリティヘッダーの確認
- [ ] CSPポリシーの設定

## ⚠️ セキュリティ警告

### 開発環境での注意点

1. **デフォルトシークレット**: 開発環境では自動生成されるデフォルトシークレットを使用
2. **レート制限**: 開発環境では緩い制限
3. **ログ出力**: 開発環境では詳細ログを出力

### 本番環境への移行時

1. **全ての環境変数を本番用に変更**
2. **セキュリティ設定の検証実行**
3. **ログレベルの調整**
4. **監視・アラートの設定**

## 🔍 脆弱性チェック

### 定期的な確認項目

#### 依存関係

```bash
npm audit
npm audit fix
```

#### 環境変数検証

```bash
npm run typecheck  # 型チェック
npm run build      # ビルドエラーチェック
```

#### セキュリティテスト

```bash
# セキュリティヘッダーの確認
curl -I https://yourdomain.com

# API認証テスト
curl -H "Authorization: Bearer invalid-token" https://yourdomain.com/api/admin
```

## 📞 インシデント対応

### セキュリティインシデント発生時

1. **即座の対応**

   - 影響範囲の特定
   - 緊急時のサービス停止判断

2. **調査**

   - ログの確認
   - 攻撃パターンの分析

3. **対策**

   - 脆弱性の修正
   - セキュリティ設定の強化

4. **事後対応**
   - ユーザーへの通知
   - 再発防止策の実装

## 🔄 定期メンテナンス

### 月次

- [ ] 依存関係の更新とセキュリティパッチ適用
- [ ] アクセスログの分析
- [ ] レート制限設定の見直し

### 四半期

- [ ] セキュリティ設定の全体見直し
- [ ] 脆弱性スキャンの実施
- [ ] インシデント対応プランの更新

---

## 📚 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
