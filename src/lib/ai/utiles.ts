import { UserProfile } from './types';

/**
 * ユーザープロファイルを文字列形式に変換
 */
export const formatUserProfile = (userProfile: UserProfile): string => {
  const profile = userProfile.profile || {};
  const interests = userProfile.interests || {};
  const userInterests = userProfile.userInterests || [];

  return `
ユーザープロファイル:
- 名前: ${userProfile.name}
- 記事スタイル: ${profile.preferredStyle || 'balanced'}
- 自己紹介: ${profile.bio || '記載なし'}

興味分野:
- カテゴリ: ${interests.categories?.join(', ') || 'なし'}
- タグ: ${interests.tags?.join(', ') || 'なし'}
- キーワード: ${interests.keywords?.join(', ') || 'なし'}

重要度順キーワード:
${userInterests
  .sort((a, b) => b.weight - a.weight)
  .slice(0, 10)
  .map((ui) => `- ${ui.keyword} (重要度: ${ui.weight})`)
  .join('\n')}
`;
};
