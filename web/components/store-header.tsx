'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';

export function StoreHeader() {
  const { user, logout }  = useAuth();
  const { itemCount }     = useCart();
  const router            = useRouter();
  const [acctOpen, setAcctOpen] = useState(false);
  const [q, setQ]         = useState('');
  const acctRef           = useRef<HTMLDivElement>(null);

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

  const initials = user?.email.slice(0, 2).toUpperCase() ?? '';

  return (
    <header style={{ background: '#EFEDE1', borderBottom: '1px solid rgba(58,58,44,0.12)', position: 'sticky', top: 0, zIndex: 50 }}>
      {/* Announcement bar — light treatment per design */}
      <div style={{ background: '#EFEDE1', color: '#3A3A2C', textAlign: 'center', fontSize: '12px', padding: '7px 12px', letterSpacing: '0.02em' }}>
        Free shipping over $75 · Plastic-free home essentials, made to last
      </div>

      {/* Main nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '24px', padding: '16px 28px' }}>
        {/* Logo */}
        <Link href="/" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', fontWeight: 600, color: '#3A3A2C', textDecoration: 'none', letterSpacing: '-0.01em', flexShrink: 0 }}>
          Sundry
        </Link>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: '22px', fontSize: '14px', color: '#6B6857' }}>
          <Link href="/" style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>Home</Link>
          <Link href="/catalog" style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>Shop all</Link>
          <Link href="/catalog?category=kitchen" style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>Kitchen</Link>
          <Link href="/catalog?category=bath" style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>Bath</Link>
          <Link href="/catalog?category=on-the-go" style={{ color: 'inherit', textDecoration: 'none', whiteSpace: 'nowrap' }}>On the Go</Link>
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
          {!user ? (
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
              <button
                onClick={() => setAcctOpen(o => !o)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)',
                  padding: '4px 10px 4px 5px', borderRadius: '999px', cursor: 'pointer',
                }}
              >
                <span style={{
                  width: '26px', height: '26px', borderRadius: '999px', background: '#EFEDE1',
                  color: '#3A3A2C', display: 'inline-flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '11px', fontWeight: 600,
                }}>
                  {initials}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>{user.email.split('@')[0]}</span>
                <span style={{ fontSize: '10px', color: '#8A8676' }}>▾</span>
              </button>

              {acctOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: '46px', width: '200px',
                  background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.12)',
                  borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                  padding: '8px', zIndex: 30,
                }}>
                  <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid rgba(58,58,44,0.06)', marginBottom: '6px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{user.email.split('@')[0]}</div>
                    <div style={{ fontSize: '11px', color: '#8A8676', fontFamily: "'Space Mono', monospace" }}>{user.email}</div>
                  </div>
                  <MenuItem href="/orders" onClick={() => setAcctOpen(false)}>My orders</MenuItem>
                  <MenuItem href="/cart" onClick={() => setAcctOpen(false)}>My cart</MenuItem>
                  {user.role === 'ADMIN' && (
                    <MenuItem href="/admin" onClick={() => setAcctOpen(false)}>Admin panel</MenuItem>
                  )}
                  <button
                    onClick={() => { logout(); setAcctOpen(false); router.push('/'); }}
                    style={{ width: '100%', textAlign: 'left', fontSize: '13px', fontWeight: 500, padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', color: '#A82E22', background: 'transparent', border: 'none' }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Cart */}
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
