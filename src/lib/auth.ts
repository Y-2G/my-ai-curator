interface User {
  id: string;
  email: string;
  name: string;
  profile?: any;
  interests?: any;
  createdAt: string;
  updatedAt: string;
}

interface AuthData {
  user: User;
  token: string;
}

const AUTH_STORAGE_KEY = 'smart-curator-auth';

export class AuthManager {
  static isAuthenticated(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const authData = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) return false;
      
      const { token } = JSON.parse(authData) as AuthData;
      if (!token) return false;
      
      // 簡単なトークン有効性チェック（JWTのexpチェックは省略）
      return true;
    } catch (error) {
      console.error('Auth check error:', error);
      return false;
    }
  }

  static getUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const authData = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) return null;
      
      const { user } = JSON.parse(authData) as AuthData;
      return user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  static getToken(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const authData = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!authData) return null;
      
      const { token } = JSON.parse(authData) as AuthData;
      return token;
    } catch (error) {
      console.error('Get token error:', error);
      return null;
    }
  }

  static login(authData: AuthData): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
      // Login data saved to localStorage
    } catch (error) {
      console.error('Login save error:', error);
    }
  }

  static logout(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      // Logout: auth data removed
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  static async loginWithCredentials(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        this.login(data.data);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login request error:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

// React Hook for authentication
export function useAuth() {
  if (typeof window === 'undefined') {
    return {
      isAuthenticated: false,
      user: null,
      login: AuthManager.loginWithCredentials,
      logout: AuthManager.logout,
    };
  }

  return {
    isAuthenticated: AuthManager.isAuthenticated(),
    user: AuthManager.getUser(),
    login: AuthManager.loginWithCredentials,
    logout: AuthManager.logout,
  };
}