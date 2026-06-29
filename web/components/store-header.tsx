'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { api } from '@/lib/api-client';

function avatarKey(userId: number) { return `avatar_${userId}`; }

export function StoreHeader() {
  const { user, token, logout } = useAuth();
  const { itemCount }           = useCart();
  const router                  = useRouter();
  const pathname                = usePathname();
  const searchParams            = useSearchParams();
  const [mounted,     setMounted]     = useState(false);
  const [acctOpen,    setAcctOpen]    = useState(false);
  const [q,           setQ]           = useState('');
  const [avatarUrl,   setAvatarUrl]   = useState<string | null>(null);
  const [uploading,   setUploading]   = useState(false);
  const acctRef   = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Load persisted avatar from localStorage
  useEffect(() => {
    if (user) {
      const stored = localStorage.getItem(avatarKey(user.userId));
      setAvatarUrl(stored);
    } else {
      setAvatarUrl(null);
    }
  }, [user]);

  function isActive(href: string) {
    const [hPath, hQuery] = href.split('?');
    if (pathname !== hPath) return false;
    if (!hQuery) return !searchParams.get('category');
    const hCategory = new URLSearchParams(hQuery).get('category');
    return searchParams.get('category') === hCategory;
  }

  // Close account menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (acctRef.current && !acctRef.current.contains(e.target as Node)) {
        setAcctOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) {
      router.push(`/catalog?search=${encodeURIComponent(q.trim())}`);
      setQ('');
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !token || !user) return;
    e.target.value = '';
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('files', file);
      const data = await api.withToken(token).upload<{ url: string }[]>('/uploads', fd);
      const url = data[0]?.url;
      if (url) {
        localStorage.setItem(avatarKey(user.userId), url);
        setAvatarUrl(url);
      }
    } catch {
      // silently ignore — avatar update is non-critical
    } finally {
      setUploading(false);
    }
  }

  const initials = user?.email.slice(0, 2).toUpperCase() ?? '';

  return (
    <header style={{ background: '#EFEDE1', borderBottom: '1px solid rgba(58,58,44,0.12)', position: 'sticky', top: 0, zIndex: 50 }}>
      {/* Announcement bar — scrolling ticker */}
      <div style={{ background: '#43432B', color: '#FAF6EC', overflow: 'hidden', fontSize: '12px', padding: '7px 0', letterSpacing: '0.06em' }}>
        <span className="ticker-track">
          Free shipping over $75&nbsp;&nbsp;·&nbsp;&nbsp;Plastic-free home essentials, made to last&nbsp;&nbsp;·&nbsp;&nbsp;Free shipping over $75&nbsp;&nbsp;·&nbsp;&nbsp;Plastic-free home essentials, made to last&nbsp;&nbsp;·&nbsp;&nbsp;
        </span>
      </div>

      {/* Main nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '16px 28px' }}>
        {/* Logo */}
        <Link href="/" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', fontWeight: 600, color: '#3A3A2C', textDecoration: 'none', letterSpacing: '-0.01em', flexShrink: 0 }}>
          Sundry
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: '28px', fontSize: '15px', fontWeight: 600 }}>
          {[
            { label: 'Home',       href: '/' },
            { label: 'Shop all',   href: '/catalog' },
            { label: 'Kitchen',    href: '/catalog?category=kitchen' },
            { label: 'Bath',       href: '/catalog?category=bath' },
            { label: 'Body',       href: '/catalog?category=body' },
            { label: 'On the Go',  href: '/catalog?category=on-the-go' },
          ].map(({ label, href }) => {
            const active = isActive(href);
            return (
              <Link key={href} href={href} style={{
                color: active ? '#43432B' : '#6B6857',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
                borderBottom: active ? '2px solid #43432B' : '2px solid transparent',
                paddingBottom: '2px',
                transition: 'color 0.15s, border-color 0.15s',
              }}>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Right side: search + user + cart */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          {/* Search */}
          <form onSubmit={handleSearch} style={{ position: 'relative' }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the shop"
              style={{
                width: '180px', fontSize: '13px', color: '#3A3A2C',
                background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)',
                borderRadius: '999px', padding: '7px 12px 7px 30px', outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#8A8676', pointerEvents: 'none' }}>⌕</span>
          </form>

          {/* Auth */}
          {!mounted || !user ? (
            <Link href="/login" style={{
              fontSize: '13px', fontWeight: 600, color: '#3A3A2C',
              background: '#EFEDE1', border: '1px solid rgba(58,58,44,0.20)',
              padding: '7px 16px', borderRadius: '6px', textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>
              Sign in
            </Link>
          ) : (
            <div ref={acctRef} style={{ position: 'relative' }}>
              {/* Hidden file input for avatar upload */}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />

              <button
                onClick={() => setAcctOpen(o => !o)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)',
                  padding: '4px 10px 4px 5px', borderRadius: '999px', cursor: 'pointer',
                }}
              >
                {/* Avatar circle — photo if set, initials otherwise */}
                <span style={{
                  width: '26px', height: '26px', borderRadius: '999px',
                  background: '#EFEDE1', overflow: 'hidden',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#3A3A2C' }}>{initials}</span>
                  )}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>{user.email.split('@')[0]}</span>
                <span style={{ fontSize: '10px', color: '#8A8676' }}>▾</span>
              </button>

              {acctOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '46px', width: '220px',
                  background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.12)',
                  borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                  padding: '8px', zIndex: 30,
                }}>
                  {/* User info */}
                  <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(58,58,44,0.06)', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                      {/* Large avatar in dropdown */}
                      <span style={{
                        width: '38px', height: '38px', borderRadius: '999px',
                        border: '2px solid rgba(58,58,44,0.10)', overflow: 'hidden',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        background: '#EFEDE1', flexShrink: 0,
                      }}>
                        {avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#3A3A2C' }}>{initials}</span>
                        )}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email.split('@')[0]}</div>
                        <div style={{ fontSize: '11px', color: '#8A8676', fontFamily: "'Space Mono', monospace", overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
                      </div>
                    </div>

                    {/* Profile photo upload — admin only */}
                    {user.role === 'ADMIN' && (
                      <button
                        onClick={() => { fileInput.current?.click(); }}
                        disabled={uploading}
                        style={{
                          width: '100%', textAlign: 'left', fontSize: '12px', fontWeight: 500,
                          padding: '6px 10px', borderRadius: '5px', cursor: uploading ? 'not-allowed' : 'pointer',
                          color: '#43432B', background: '#FAF6EC',
                          border: '1px solid rgba(58,58,44,0.14)', opacity: uploading ? 0.6 : 1,
                          display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        <span style={{ fontSize: '14px' }}>📷</span>
                        {uploading ? 'Uploading…' : avatarUrl ? 'Update profile photo' : 'Upload profile photo'}
                      </button>
                    )}
                  </div>

                  {user.role === 'CUSTOMER' && (
                    <>
                      <MenuItem href="/orders" onClick={() => setAcctOpen(false)}>My orders</MenuItem>
                      <MenuItem href="/cart" onClick={() => setAcctOpen(false)}>My cart</MenuItem>
                    </>
                  )}
                  {user.role === 'ADMIN' && (
                    <MenuItem href="/admin" onClick={() => setAcctOpen(false)}>Admin panel</MenuItem>
                  )}
                  <button
                    onClick={async () => {
                      setAcctOpen(false);
                      await logout();
                      router.push('/');
                    }}
                    style={{ width: '100%', textAlign: 'left', fontSize: '13px', fontWeight: 500, padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', color: '#A82E22', background: 'transparent', border: 'none' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cart — only for customers */}
          {(!mounted || user?.role !== 'ADMIN') && (
            <Link
              href="/cart"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                fontSize: '13px', fontWeight: 600, color: '#3A3A2C',
                background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)',
                padding: '7px 14px', borderRadius: '999px', textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Cart
              {itemCount > 0 && (
                <span style={{
                  background: '#43432B', color: '#FAF6EC', fontSize: '11px',
                  fontWeight: 700, borderRadius: '999px', padding: '1px 7px',
                }}>
                  {itemCount}
                </span>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function MenuItem({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{ display: 'block', fontSize: '13px', fontWeight: 500, padding: '8px 10px', borderRadius: '6px', color: '#3A3A2C', textDecoration: 'none' }}
    >
      {children}
    </Link>
  );
}
