'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

function NavItem({ href, icon, label, badge }: { href: string; icon: string; label: string; badge?: number }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== '/admin' && pathname.startsWith(href));
  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '9px 12px', borderRadius: '8px', textDecoration: 'none',
        fontSize: '14px', fontWeight: 500,
        background: active ? '#43432B' : 'transparent',
        color: active ? '#FAF6EC' : '#6B6857',
        transition: 'background 0.12s',
      }}
    >
      <span style={{ fontSize: '16px', lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace", fontWeight: 700, background: '#B57A1A', color: '#FAF6EC', borderRadius: '999px', padding: '1px 7px', minWidth: '20px', textAlign: 'center' }}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router                    = useRouter();
  const pathname                  = usePathname();
  const [attentionCount, setAttentionCount] = useState(0);

  // Client-side admin guard — wait for token hydration before redirecting
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'ADMIN') { router.replace('/'); }
  }, [user, loading, router]);

  // Page title from route
  const PAGE_TITLES: Record<string, string> = {
    '/admin':              'Dashboard',
    '/admin/products':     'Products',
    '/admin/categories':   'Categories',
    '/admin/orders':       'Orders',
  };
  const pageTitle =
    Object.entries(PAGE_TITLES).find(([k]) => k !== '/admin' ? pathname.startsWith(k) : pathname === k)?.[1]
    ?? 'Admin';

  // Initials for avatar
  const initials = user?.email.slice(0, 2).toUpperCase() ?? 'A';

  if (loading || !user || user.role !== 'ADMIN') {
    return <div style={{ background: '#FAF6EC', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8A8676' }}>Checking access…</div>;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#FAF6EC' }}>
      {/* Sidebar */}
      <aside style={{ width: '224px', flexShrink: 0, background: '#EFEDE1', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 40, borderRight: '1px solid rgba(58,58,44,0.12)' }}>
        {/* Brand */}
        <div
          onClick={() => router.push('/')}
          style={{ padding: '22px 20px 16px', cursor: 'pointer' }}
        >
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 600, color: '#3A3A2C', letterSpacing: '-0.01em' }}>Sundry</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', letterSpacing: '0.14em', color: '#8A8676', marginTop: '2px' }}>ADMIN CONSOLE</div>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(58,58,44,0.10)', margin: '0 16px 14px' }} />

        {/* Nav */}
        <nav style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
          <NavItem href="/admin"              icon="⊞" label="Dashboard" />
          <NavItem href="/admin/products"     icon="⬚" label="Products" />
          <NavItem href="/admin/categories"   icon="◫" label="Categories" />
          <NavItem href="/admin/orders"       icon="≡" label="Orders" badge={attentionCount} />
        </nav>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(58,58,44,0.10)' }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '9px', color: '#A39E8C', letterSpacing: '0.08em', lineHeight: 1.6 }}>
            SUNDRY SYSTEM<br />v0.2 · TEST DATA
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div style={{ marginLeft: '224px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Top bar */}
        <header style={{ height: '60px', background: '#FFFFFF', borderBottom: '1px solid rgba(58,58,44,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 26px', position: 'sticky', top: 0, zIndex: 30, flexShrink: 0 }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '17px', fontWeight: 500, color: '#3A3A2C' }}>{pageTitle}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '14px', color: '#6B6857' }}>{user.email.split('@')[0]}</span>
            <div style={{ width: '30px', height: '30px', borderRadius: '999px', background: '#43432B', color: '#FAF6EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600 }}>
              {initials}
            </div>
            <button
              onClick={async () => { await logout(); router.push('/'); }}
              style={{ fontSize: '13px', fontWeight: 600, color: '#6B6857', background: 'transparent', border: '1px solid rgba(58,58,44,0.16)', padding: '5px 12px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '26px' }}>
          <AttentionProvider setAttentionCount={setAttentionCount}>
            {children}
          </AttentionProvider>
        </main>
      </div>
    </div>
  );
}

// Minimal context bridge to pass attentionCount setter to children (orders page will call it)
import { createContext, useContext } from 'react';
export const AttentionCtx = createContext<(n: number) => void>(() => {});
export function useSetAttention() { return useContext(AttentionCtx); }
function AttentionProvider({ setAttentionCount, children }: { setAttentionCount: (n: number) => void; children: React.ReactNode }) {
  return <AttentionCtx.Provider value={setAttentionCount}>{children}</AttentionCtx.Provider>;
}
