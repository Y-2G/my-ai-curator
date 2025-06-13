-- Delete existing categories and their relationships
DELETE FROM "ArticleTag" WHERE "articleId" IN (SELECT "id" FROM "Article");
DELETE FROM "Source" WHERE "articleId" IN (SELECT "id" FROM "Article");
DELETE FROM "Article";
DELETE FROM "Category";

-- Insert new categories
INSERT INTO "Category" ("id", "name", "description", "color", "createdAt", "updatedAt") VALUES
  (gen_random_uuid(), '話題・トレンド', '最新の話題やトレンド情報', '#FF6B6B', NOW(), NOW()),
  (gen_random_uuid(), 'ライフスタイル', '日常生活や暮らしに関する情報', '#4ECDC4', NOW(), NOW()),
  (gen_random_uuid(), 'フード＆レシピ', '料理やグルメに関する情報', '#FFE66D', NOW(), NOW()),
  (gen_random_uuid(), 'ファッション＆ビューティー', 'ファッションや美容に関する情報', '#FF6B9D', NOW(), NOW()),
  (gen_random_uuid(), 'おでかけ・旅行', '旅行や観光スポットの情報', '#95E1D3', NOW(), NOW()),
  (gen_random_uuid(), 'エンタメ・カルチャー', 'エンターテインメントや文化情報', '#C7CEEA', NOW(), NOW()),
  (gen_random_uuid(), 'ガジェット・テック', 'テクノロジーやガジェット情報', '#686DE0', NOW(), NOW()),
  (gen_random_uuid(), 'キャリア・ビジネス', 'キャリアやビジネスに関する情報', '#30336B', NOW(), NOW()),
  (gen_random_uuid(), 'ヘルス＆メンタル', '健康やメンタルヘルスに関する情報', '#6AB04C', NOW(), NOW()),
  (gen_random_uuid(), '社会・教養・雑学', '社会問題や教養、雑学情報', '#EB4D4B', NOW(), NOW());