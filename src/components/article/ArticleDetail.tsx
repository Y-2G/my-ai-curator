import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { CategoryBadge } from './CategoryBadge';
import { TagList } from './TagList';
import { InterestScore } from './InterestScore';
import { formatDateTime } from '@/lib/utils/date';
import type { Article } from '@/lib/types';

interface ArticleDetailProps {
  article: Article & { content: string; sources: Array<{ id: string; url: string; title: string | null; type: string }> };
}

export function ArticleDetail({ article }: ArticleDetailProps) {
  return (
    <article className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー部分 */}
        <header className="mb-8">
          <div className="flex items-start justify-between mb-4">
            {article.category && (
              <CategoryBadge category={article.category} />
            )}
            <InterestScore score={article.interestScore} showLabel size="lg" />
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            {article.title}
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            {article.summary}
          </p>
          
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
            <time dateTime={article.publishedAt}>
              公開日: {formatDateTime(article.publishedAt)}
            </time>
            <span>•</span>
            <span>品質スコア: {article.qualityScore}/10</span>
          </div>
        </header>

        {/* メインコンテンツ */}
        <Card className="mb-8">
          <div 
            className="prose prose-lg dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: convertToHtml(article.content) }}
          />
        </Card>

        {/* ソース情報 */}
        {article.sources && article.sources.length > 0 && (
          <Card className="mb-8">
            <h2 className="text-xl font-semibold mb-4">参考情報源</h2>
            <ul className="space-y-3">
              {article.sources.map((source) => (
                <li key={source.id} className="flex items-start gap-3">
                  <Badge variant="info" size="sm" className="mt-0.5">
                    {source.type}
                  </Badge>
                  <div className="flex-1">
                    <a 
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {source.title || source.url}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* タグ */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">タグ</h2>
          <TagList tags={article.tags} size="md" />
        </div>

        {/* ナビゲーション */}
        <nav className="border-t pt-8">
          <Link 
            href="/articles"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            記事一覧に戻る
          </Link>
        </nav>
      </div>
    </article>
  );
}

// Markdownを簡易的にHTMLに変換（改善版）
function convertToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // コードブロックを一時的に保護
  const codeBlocks: string[] = [];
  let processedMd = markdown.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  
  // インラインコードを保護
  const inlineCodes: string[] = [];
  processedMd = processedMd.replace(/`[^`]+`/g, (match) => {
    inlineCodes.push(match);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });
  
  // 基本的な変換
  let html = processedMd
    .replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mt-8 mb-4">$1</h1>')
    .replace(/^\* (.*)$/gim, '<li class="ml-6 list-disc">$1</li>')
    .replace(/^- (.*)$/gim, '<li class="ml-6 list-disc">$1</li>')
    .replace(/^\d+\. (.*)$/gim, '<li class="ml-6 list-decimal">$1</li>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n\n/g, '</p><p class="mb-4">')
    .replace(/^/, '<p class="mb-4">')
    .replace(/$/, '</p>');
  
  // リストを適切にラップ
  html = html.replace(/(<li[^>]*>.*<\/li>\s*)+/g, (match) => {
    return `<ul class="mb-4">${match}</ul>`;
  });
  
  // コードブロックを復元
  codeBlocks.forEach((code, i) => {
    const content = code.replace(/```[\w]*\n?/, '').replace(/```$/, '');
    html = html.replace(
      `__CODE_BLOCK_${i}__`,
      `<pre class="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto mb-4"><code>${escapeHtml(content.trim())}</code></pre>`
    );
  });
  
  // インラインコードを復元
  inlineCodes.forEach((code, i) => {
    const content = code.replace(/`/g, '');
    html = html.replace(
      `__INLINE_CODE_${i}__`,
      `<code class="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm">${escapeHtml(content)}</code>`
    );
  });
  
  return html;
}

// HTMLエスケープ
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}