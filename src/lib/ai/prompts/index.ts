import type { PromptTemplate } from '../types';

// プロンプトテンプレート管理クラス
export class PromptManager {
  private static instance: PromptManager;
  private templates: Map<string, PromptTemplate> = new Map();

  private constructor() {
    this.loadDefaultTemplates();
  }

  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  private loadDefaultTemplates(): void {
    const defaultTemplates: PromptTemplate[] = [
      {
        id: 'search-query-generation',
        name: '検索クエリ生成',
        description: 'ユーザープロファイルに基づいて最適な検索クエリを生成',
        template: SEARCH_QUERY_TEMPLATE,
        variables: ['userInterests', 'techLevel', 'recentTopics', 'contentTypes', 'language'],
        category: 'search',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'content-quality-evaluation',
        name: 'コンテンツ品質評価',
        description: 'コンテンツの品質を多角的に評価してスコアを算出',
        template: CONTENT_QUALITY_TEMPLATE,
        variables: ['title', 'summary', 'source', 'publishedAt', 'contentType'],
        category: 'evaluation',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'interest-score-calculation',
        name: '興味度スコア計算',
        description: 'ユーザーの興味に基づいてコンテンツの関心度を計算',
        template: INTEREST_SCORE_TEMPLATE,
        variables: ['content', 'userProfile', 'recentActivity'],
        category: 'evaluation',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'category-classification',
        name: 'カテゴリ分類',
        description: 'コンテンツを適切なカテゴリに自動分類',
        template: CATEGORY_CLASSIFICATION_TEMPLATE,
        variables: ['title', 'summary', 'availableCategories'],
        category: 'classification',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'tag-generation',
        name: 'タグ生成',
        description: 'コンテンツから関連タグを自動生成',
        template: TAG_GENERATION_TEMPLATE,
        variables: ['title', 'summary', 'content', 'maxTags'],
        category: 'classification',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'article-generation',
        name: '記事生成',
        description: '複数のソースから統合記事を生成',
        template: ARTICLE_GENERATION_TEMPLATE,
        variables: ['sources', 'userProfile', 'targetLength', 'style'],
        category: 'generation',
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    defaultTemplates.forEach((template) => {
      this.templates.set(template.id, template);
    });
  }

  getTemplate(id: string): PromptTemplate | null {
    return this.templates.get(id) || null;
  }

  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: PromptTemplate['category']): PromptTemplate[] {
    return Array.from(this.templates.values()).filter((template) => template.category === category);
  }

  // テンプレートに変数を埋め込む
  renderTemplate(templateId: string, variables: Record<string, string>): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let rendered = template.template;

    // 変数を置換
    template.variables.forEach((variable) => {
      const value = variables[variable];
      if (value === undefined) {
        throw new Error(
          `Required variable '${variable}' not provided for template '${templateId}'`
        );
      }

      const regex = new RegExp(`{{${variable}}}`, 'g');
      rendered = rendered.replace(regex, value);
    });

    // 未置換の変数がないかチェック
    const unreplacedVars = rendered.match(/{{[^}]+}}/g);
    if (unreplacedVars) {
      throw new Error(
        `Unresolved variables in template '${templateId}': ${unreplacedVars.join(', ')}`
      );
    }

    return rendered;
  }

  // カスタムテンプレートの追加/更新
  addTemplate(template: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>): void {
    const fullTemplate: PromptTemplate = {
      ...template,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.templates.set(template.id, fullTemplate);
  }

  updateTemplate(id: string, updates: Partial<PromptTemplate>): void {
    const existing = this.templates.get(id);
    if (!existing) {
      throw new Error(`Template not found: ${id}`);
    }

    const updated: PromptTemplate = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.templates.set(id, updated);
  }
}

// プロンプトテンプレート定義
const SEARCH_QUERY_TEMPLATE = `
あなたは最新情報に精通した検索エキスパートです。
以下のユーザープロファイルに基づいて、最も効果的な検索クエリを生成してください。

# ユーザープロファイル
- 興味分野: {{userInterests}}
- 最近の関心事: {{recentTopics}}
- 好むコンテンツタイプ: {{contentTypes}}
- 言語設定: {{language}}

# 要件
1. 各検索ソース（Google検索API）に最適化されたクエリを生成
2. ${new Date().toISOString()}時点での最新の情報とトレンドを捉えられるようにする
3. 重複を避け、多様な観点でクエリを作成

# 出力形式
JSON形式で以下の構造で出力してください：
{
  "queries": [
    {
      "query": "検索クエリ文字列",
      "source": "対象ソース",
      "priority": 1-10,
      "keywords": ["キーワード1", "キーワード2"]
    }
  ],
  "reasoning": "クエリ選択の理由"
}
`;

const CONTENT_QUALITY_TEMPLATE = `
あなたは記事コンテンツの品質評価エキスパートです。
以下のコンテンツを多角的に評価し、品質スコア（1-10）を算出してください。

# 評価対象コンテンツ
- タイトル: {{title}}
- 要約: {{summary}}
- ソース: {{source}}
- 公開日: {{publishedAt}}
- コンテンツタイプ: {{contentType}}

# 評価基準
1. **正確性** (25%): 正確性、事実の信頼性
2. **関連性** (20%): 現在のトレンドや重要性との関連
3. **新鮮さ** (20%): 情報の新しさ、時代に即しているか
4. **深度** (20%): 内容の深さ、詳細さ、専門性
5. **可読性** (15%): 理解しやすさ、構造の明確さ

# 出力形式
JSON形式で以下の構造で出力してください：
{
  "qualityScore": 8.5,
  "reasoning": "評価の詳細理由",
  "factors": {
    "accuracy": 9,
    "relevance": 8,
    "freshness": 9,
    "depth": 8,
    "readability": 8
  },
  "flags": ["potential_bias", "outdated_info"]
}
`;

const INTEREST_SCORE_TEMPLATE = `
あなたはユーザーの興味を分析するエキスパートです。
以下のコンテンツが指定されたユーザーにとってどれだけ興味深いかを1-10で評価してください。

# コンテンツ情報
{{content}}

# ユーザープロファイル
{{userProfile}}

# 最近のアクティビティ
{{recentActivity}}

# 評価基準
1. **トピックの関連性** (50%): ユーザーの興味分野との合致度
2. **新規性** (30%): ユーザーにとって新しい情報・視点か
3. **実用性** (20%): 実際に役立つ、行動に移せる内容か

# 出力形式
JSON形式で以下の構造で出力してください：
{
  "score": 8,
  "reasoning": "スコア算出の詳細理由",
  "factors": {
    "topicRelevance": 9,
    "difficultyMatch": 8,
    "novelty": 7,
    "actionability": 8
  },
  "matchedKeywords": ["React", "TypeScript", "performance"]
}
`;

const CATEGORY_CLASSIFICATION_TEMPLATE = `
以下のコンテンツを最適なカテゴリに分類してください。

# コンテンツ
- タイトル: {{title}}
- 要約: {{summary}}

# 利用可能カテゴリ
{{availableCategories}}

# 分類基準
- 主要なトピックに基づいて分類
- 最も関連性の高いカテゴリを選択
- 不明な場合は「その他」を選択

# 出力形式
JSON形式で以下の構造で出力してください：
{
  "category": "選択されたカテゴリ名",
  "confidence": 0.85,
  "alternativeCategories": [
    {"name": "代替カテゴリ1", "confidence": 0.15},
    {"name": "代替カテゴリ2", "confidence": 0.10}
  ],
  "reasoning": "分類理由の説明"
}
`;

const TAG_GENERATION_TEMPLATE = `
以下のコンテンツから関連タグを生成してください。

# コンテンツ
- タイトル: {{title}}
- 要約: {{summary}}
- 本文（一部）: {{content}}

# 要件
- 最大{{maxTags}}個のタグを生成
- 技術名、概念、難易度、コンテンツタイプなど多様な観点でタグ付け
- 一般的すぎるタグは避ける
- 英語タグと日本語タグの両方を考慮

# 出力形式
JSON形式で以下の構造で出力してください：
{
  "tags": [
    {
      "name": "React",
      "relevance": 0.95,
      "type": "technology"
    },
    {
      "name": "中級者向け",
      "relevance": 0.80,
      "type": "difficulty"
    }
  ],
  "reasoning": "タグ選択の理由"
}
`;

const ARTICLE_GENERATION_TEMPLATE = `
あなたは記事をキュレーションする専門家です。
提供された情報源を基に、各記事を個別に紹介するキュレーション記事を作成してください。

# 情報源
{{sources}}

# 読者プロファイル
{{userProfile}}

# 記事要件
- 文体: {{style}}
- Markdown形式で出力
- 各情報源を個別にリスト形式で紹介
- 統合・要約はしない

# 重要な指示
1. タイトルは情報源を抽象化して要約する
2. 導入文は2文程度で簡潔に
3. 本文は提供された各記事を以下の形式で羅列する：

## [記事タイトル](記事URL)
記事の内容について1-3行程度で要約。何を学べるか、なぜ有用かを簡潔に説明。

4. まとめや結論は不要
5. 各記事を独立して紹介し、全体をまとめたテーマで統合しない

# 出力例
今週注目の情報をキュレーションしました。各ページから最新の動向をお楽しみください。

## [React Server Components入門](https://example.com/rsc-intro)
React Server Componentsの基本概念と実装方法について解説。サーバーサイドレンダリングとの違いや実際のコード例も含まれており、Next.jsでの活用方法も紹介されています。

## [TypeScript 5.4の新機能](https://example.com/ts-5-4)
最新のTypeScriptで追加されたnoUncheckedIndexedAccessオプションについて詳しく解説。型安全性の向上と実際の開発での活用シーンが具体的に説明されています。

# 出力形式
JSON形式で以下の構造で出力してください：
{
  "title": "キュレーションタイトル",
  "summary": "2文程度の導入文",
  "content": "Markdown形式の本文（各記事を## [タイトル](URL)形式で個別紹介）",
  "category": "適切なカテゴリ",
  "tags": ["タグ1", "タグ2"],
  "sources": [
    {
      "url": "https://...",
      "title": "ソースタイトル",
      "relevance": 0.9
    }
  ],
  "confidence": 0.85,
  "metadata": {
    "wordCount": 400,
    "readingTime": 2,
    "difficulty": "intermediate",
    "contentType": "curation"
  }
}
`;

export default PromptManager.getInstance();
