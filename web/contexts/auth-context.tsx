'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { api } from '@/lib/api-client';

const TOKEN_KEY = 'ecomm_token';

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
  logout:  () => void;
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
  document.cookie = `${TOKEN_KEY}=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
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
      else         { localStorage.removeItem(TOKEN_KEY); clearCookie(); }
    }
    setLoading(false);
  }, []);

  const applyToken = useCallback((t: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    setCookie(t);
    setToken(t);
    setUser(parseToken(t));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await api.auth.login(email, password);
    applyToken(accessToken);
  }, [applyToken]);

  const signup = useCallback(async (email: string, password: string) => {
    const { accessToken } = await api.auth.signup(email, password);
    applyToken(accessToken);
  }, [applyToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
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
