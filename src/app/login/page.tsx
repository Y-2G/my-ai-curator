'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthManager } from '@/lib/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await AuthManager.loginWithCredentials(email, password);

      if (result.success) {
        // Login successful, redirecting to admin page
        router.push('/admin');
      } else {
        setError(result.error || 'ログインに失敗しました');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('ログイン中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">🔒 管理者ログイン</h2>
          <p className="mt-2 text-center text-sm text-gray-600">My AI Curator 管理者専用ページ</p>
        </div>

        <Card className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <Input
                label="メールアドレス"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="2g.4423@gmail.com"
                required
                disabled={loading}
              />

              <Input
                label="パスワード"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="パスワードを入力"
                required
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </Button>
          </form>
        </Card>

        <div className="text-center">
          <Button onClick={() => router.push('/')} variant="secondary" className="text-gray-600">
            ← ホームに戻る
          </Button>
        </div>
      </div>
    </div>
  );
}
