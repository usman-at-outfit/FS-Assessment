'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api, Order, formatCents } from '@/lib/api-client';

const STATUS_STYLES: Record<Order['status'], { bg: string; color: string; label: string }> = {
  PENDING:    { bg: '#F5F5EF', color: '#6B6857',  label: 'Pending'    },
  PROCESSING: { bg: '#EEF4FF', color: '#3B5FBB',  label: 'Processing' },
  SHIPPED:    { bg: '#EEF9FF', color: '#1A6F8A',  label: 'Shipped'    },
  DELIVERED:  { bg: '#E3F0E8', color: '#2E7D52',  label: 'Delivered'  },
  CANCELLED:  { bg: '#F6E0DD', color: '#A82E22',  label: 'Cancelled'  },
};

export default function OrdersPage() {
  const { user, token } = useAuth();
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.withToken(token).get<Order[]>('/orders')
      .then(setOrders)
      .catch(() => {})
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
    <div style={{ padding: '28px', maxWidth: '860px' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '32px', margin: '0 0 4px', color: '#3A3A2C' }}>Orders</h1>
      <p style={{ fontSize: '14px', color: '#8A8676', marginTop: 0, marginBottom: '24px' }}>{orders.length} order{orders.length !== 1 ? 's' : ''}</p>

      {loading && (
        <div style={{ color: '#8A8676', fontSize: '14px' }}>Loading…</div>
      )}

      {!loading && orders.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px', background: '#FFFFFF', border: '1px dashed rgba(58,58,44,0.16)', borderRadius: '12px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', marginBottom: '6px' }}>No orders yet</div>
          <div style={{ fontSize: '14px', color: '#8A8676', marginBottom: '18px' }}>When you place your first order, it'll appear here.</div>
          <Link href="/catalog" style={{ display: 'inline-block', fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none' }}>Start shopping</Link>
        </div>
      )}

      {!loading && orders.map(order => {
        const s = STATUS_STYLES[order.status];
        return (
          <div key={order.id} style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>Order #{order.id}</span>
                <span style={{ fontSize: '12px', color: '#8A8676', marginLeft: '12px' }}>{new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#3A3A2C' }}>{formatCents(order.totalCents)}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '999px', background: s.bg, color: s.color }}>{s.label}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {order.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6B6857' }}>
                  <span style={{ color: '#3A3A2C' }}>{item.product.name} <span style={{ color: '#8A8676' }}>×{item.quantity}</span></span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, color: '#3A3A2C' }}>{formatCents(item.unitPriceCents * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
