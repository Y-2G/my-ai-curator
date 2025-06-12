import OpenAI from 'openai';

export const model = 'gpt-4o-mini'; // コスト効率の良いモデル
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
