'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { api, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/lib/api-client';

const TOKEN_KEY = ACCESS_TOKEN_KEY;

interface AuthUser {
  userId: number;
  email:  string;
  role:   'ADMIN' | 'CUSTOMER';
}

interface AuthContextValue {
  user:    AuthUser | null;
  token:   string | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<void>;
  signup:  (email: string, password: string) => Promise<void>;
  logout:  () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Display-only: decodes payload for client-side UI state without verifying the signature.
// The API validates the signature on every request — this is not a security boundary.
function parseToken(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { userId: payload.sub, email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}

// Also write a JS-readable cookie so Next.js middleware can check auth.
function setCookie(token: string) {
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
}
function clearCookie() {
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token,   setToken]   = useState<string | null>(null);
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      const parsed = parseToken(stored);
      if (parsed) { setToken(stored); setUser(parsed); }
      else         { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(REFRESH_TOKEN_KEY); clearCookie(); }
    }
    setLoading(false);
  }, []);

  // Sync auth state when api-client silently refreshes the access token.
  useEffect(() => {
    function handleRefresh(e: Event) {
      const { accessToken } = (e as CustomEvent<{ accessToken: string }>).detail;
      setToken(accessToken);
      setUser(parseToken(accessToken));
    }
    window.addEventListener('auth:token-refreshed', handleRefresh);
    return () => window.removeEventListener('auth:token-refreshed', handleRefresh);
  }, []);

  // Global 401 handler — refresh already failed by the time this fires.
  // Clear all state and send the user home.
  useEffect(() => {
    function handle401() {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (!stored) return; // already logged out — nothing to do
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      clearCookie();
      setToken(null);
      setUser(null);
      window.location.href = '/';
    }
    window.addEventListener('auth:unauthorized', handle401);
    return () => window.removeEventListener('auth:unauthorized', handle401);
  }, []);

  const applyToken = useCallback((accessToken: string, refreshToken?: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    setCookie(accessToken);
    setToken(accessToken);
    setUser(parseToken(accessToken));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken } = await api.auth.login(email, password);
    applyToken(accessToken, refreshToken);
  }, [applyToken]);

  const signup = useCallback(async (email: string, password: string) => {
    const { accessToken, refreshToken } = await api.auth.signup(email, password);
    applyToken(accessToken, refreshToken);
  }, [applyToken]);

  const logout = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/auth/logout`,
          { method: 'POST', headers: { Authorization: `Bearer ${stored}` } },
        );
      } catch {
        // Network failure — still clear client state
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    clearCookie();
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
