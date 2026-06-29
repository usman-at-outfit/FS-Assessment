'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api-client';

export default function LoginPage() {
  const { login }   = useAuth();
  const router      = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: '14px', background: '#FFFFFF',
    border: '1px solid rgba(58,58,44,0.20)', borderRadius: '6px',
    padding: '10px 12px', outline: 'none', color: '#3A3A2C',
    fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: '#3A3A2C', marginBottom: '6px',
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.12)', borderRadius: '12px', padding: '32px' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '26px', color: '#3A3A2C', margin: '0 0 6px' }}>
        Welcome back
      </h1>
      <p style={{ fontSize: '14px', color: '#8A8676', margin: '0 0 24px' }}>Sign in to your Sundry account</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={labelStyle}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />
        </div>

        {error && (
          <div style={{ fontSize: '13px', color: '#A82E22', background: '#F6E0DD', border: '1px solid #EFCBC6', borderRadius: '6px', padding: '10px 12px' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', fontSize: '15px', fontWeight: 600,
            color: '#FAF6EC', background: loading ? '#8A8676' : '#43432B',
            border: 'none', padding: '13px', borderRadius: '6px',
            cursor: loading ? 'not-allowed' : 'pointer', marginTop: '4px',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p style={{ textAlign: 'center', fontSize: '13px', color: '#8A8676', marginTop: '20px' }}>
        No account?{' '}
        <Link href="/signup" style={{ fontWeight: 600, color: '#43432B', textDecoration: 'none' }}>
          Create one
        </Link>
      </p>
    </div>
  );
}
