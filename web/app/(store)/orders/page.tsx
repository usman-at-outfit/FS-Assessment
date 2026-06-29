'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api, Order, formatCents } from '@/lib/api-client';
import { ORDER_STATUS, statusPillStyle } from '@/lib/order-status';

export default function OrdersPage() {
  const { user, token } = useAuth();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.withToken(token).get<Order[]>('/orders')
      .then(data => { setOrders(data); setError(''); })
      .catch(() => setError('Could not load orders — please try again.'))
      .finally(() => setLoading(false));
  }, [token]);

  if (!user) {
    return (
      <div style={{ padding: '60px 28px', textAlign: 'center', maxWidth: '440px', margin: '0 auto' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', marginBottom: '6px', color: '#3A3A2C' }}>Sign in to see your orders</div>
        <div style={{ fontSize: '14px', color: '#8A8676', marginBottom: '20px' }}>Your order history and tracking live in your account.</div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/login" style={{ fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', border: 'none', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/signup" style={{ fontSize: '14px', fontWeight: 600, color: '#3A3A2C', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>Create account</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#43432B', marginBottom: '6px' }}>Account</div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '32px', margin: '0 0 4px', color: '#3A3A2C' }}>Order history</h1>
      <p style={{ fontSize: '14px', color: '#8A8676', marginTop: 0, marginBottom: '24px' }}>
        Signed in as <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px' }}>{user.email}</span>
      </p>

      {loading && <div style={{ color: '#8A8676', fontSize: '14px' }}>Loading…</div>}

      {!loading && error && (
        <div style={{ padding: '16px 20px', background: '#F6E0DD', border: '1px solid #EFCBC6', borderRadius: '8px', color: '#8A241A', fontSize: '14px', marginBottom: '16px' }}>{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px', background: '#FFFFFF', border: '1px dashed rgba(58,58,44,0.16)', borderRadius: '12px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', marginBottom: '6px' }}>No orders yet</div>
          <div style={{ fontSize: '14px', color: '#8A8676', marginBottom: '18px' }}>When you place your first order, it&apos;ll appear here.</div>
          <Link href="/catalog" style={{ display: 'inline-block', fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none' }}>Start shopping</Link>
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '110px 1.4fr 1fr 110px 120px 36px', padding: '10px 20px', borderBottom: '1px solid rgba(58,58,44,0.10)', background: '#FBF8EF' }}>
            {(['Order', 'Items', 'Status', 'Date', 'Total', ''] as const).map((h, i) => (
              <div key={i} style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: '#8A8676' }}>{h}</div>
            ))}
          </div>

          {orders.map((order, idx) => {
            const itemQty = order.items.reduce((n, i) => n + i.quantity, 0);
            const isLast = idx === orders.length - 1;
            return (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                style={{
                  display: 'grid', gridTemplateColumns: '110px 1.4fr 1fr 110px 120px 36px',
                  padding: '14px 20px', alignItems: 'center',
                  borderBottom: isLast ? 'none' : '1px solid rgba(58,58,44,0.06)',
                  textDecoration: 'none', color: 'inherit',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(58,58,44,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', fontWeight: 600, color: '#3A3A2C' }}>#{order.id}</div>
                <div style={{ fontSize: '13px', color: '#6B6857' }}>
                  {itemQty} item{itemQty !== 1 ? 's' : ''}
                </div>
                <div>
                  <span style={statusPillStyle(order.status)}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: ORDER_STATUS[order.status].dot, flexShrink: 0 }} />
                    {ORDER_STATUS[order.status].label}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#8A8676' }}>
                  {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>
                  {formatCents(order.totalCents)}
                </div>
                <div style={{ textAlign: 'right', color: '#8A8676', fontSize: '16px' }}>›</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
