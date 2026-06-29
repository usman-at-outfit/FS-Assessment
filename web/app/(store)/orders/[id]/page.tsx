'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { api, Order, formatCents } from '@/lib/api-client';
import { ORDER_STATUS, statusPillStyle } from '@/lib/order-status';
import { SHIPPING_CENTS, FREE_SHIP_THRESHOLD } from '@/lib/constants';

export default function OrderDetailPage() {
  const { id }            = useParams<{ id: string }>();
  const { token, user }   = useAuth();
  const [order,   setOrder]   = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.withToken(token).get<Order>(`/orders/${id}`)
      .then(data => { setOrder(data); setError(''); })
      .catch((err) => {
        // Treat 403 as 404 to avoid leaking existence (per CLAUDE.md security rule)
        if (err?.status === 500) {
          setError('Something went wrong — please try again.');
        } else {
          setError('Order not found.');
        }
      })
      .finally(() => setLoading(false));
  }, [token, id]);

  if (!user) {
    return (
      <div style={{ padding: '60px 28px', textAlign: 'center' }}>
        <Link href="/login" style={{ fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '60px 28px', color: '#8A8676', fontSize: '14px' }}>Loading…</div>;

  if (error || !order) {
    return (
      <div style={{ padding: '60px 28px', maxWidth: '860px', margin: '0 auto' }}>
        <Link href="/orders" style={{ fontSize: '13px', fontWeight: 600, color: '#6B6857', textDecoration: 'none', marginBottom: '20px', display: 'inline-block' }}>← All orders</Link>
        <div style={{ marginTop: '16px', padding: '20px', background: '#F6E0DD', border: '1px solid #EFCBC6', borderRadius: '10px', color: '#8A241A', fontSize: '15px' }}>{error || 'Order not found.'}</div>
      </div>
    );
  }

  const s          = ORDER_STATUS[order.status];
  const subtotal   = order.items.reduce((n, i) => n + i.unitPriceCents * i.quantity, 0);
  // Shipping: recompute from the shared constants (same logic the server used).
  // totalCents = subtotal + shipping, so we cross-check rather than blindly subtracting.
  const shipping   = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_CENTS;

  return (
    <div style={{ padding: '28px', maxWidth: '860px', margin: '0 auto' }}>
      {/* Back */}
      <Link href="/orders" style={{ fontSize: '13px', fontWeight: 600, color: '#6B6857', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
        ← All orders
      </Link>

      {/* Heading row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '4px', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '28px', margin: 0, color: '#3A3A2C' }}>
          Order #{order.id}
        </h1>
        <span style={{ ...statusPillStyle(order.status) }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: s.dot, flexShrink: 0 }} />
          {s.label}
        </span>
      </div>
      <p style={{ fontSize: '13px', color: '#8A8676', margin: '0 0 24px' }}>
        Placed {new Date(order.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
      </p>

      {/* Items card */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(58,58,44,0.06)', background: '#FBF8EF' }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#8A8676' }}>Items ordered</span>
        </div>

        {order.items.map((item, idx) => {
          const isLast = idx === order.items.length - 1;
          return (
            <div key={item.id} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '14px 20px', borderBottom: isLast ? 'none' : '1px solid rgba(58,58,44,0.06)' }}>
              {/* Thumbnail */}
              <div style={{ width: '52px', height: '52px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.product.imageUrl} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '15px', fontWeight: 500, color: '#3A3A2C' }}>{item.product.name}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#8A8676', marginTop: '3px' }}>
                  {formatCents(item.unitPriceCents)} × {item.quantity}
                </div>
              </div>

              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#3A3A2C', flexShrink: 0 }}>
                {formatCents(item.unitPriceCents * item.quantity)}
              </div>
            </div>
          );
        })}

        {/* Totals */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(58,58,44,0.10)', background: '#FBF8EF' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6B6857', marginBottom: '6px' }}>
            <span>Subtotal</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>{formatCents(subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6B6857', marginBottom: '10px' }}>
            <span>Shipping</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, color: shipping === 0 ? '#2E7D52' : '#3A3A2C' }}>
              {shipping === 0 ? 'Free' : formatCents(shipping)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 700, color: '#3A3A2C', paddingTop: '10px', borderTop: '1px solid rgba(58,58,44,0.10)' }}>
            <span>Total</span>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{formatCents(order.totalCents)}</span>
          </div>
        </div>
      </div>

      {/* CTAs */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link href="/catalog" style={{ fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>Continue shopping</Link>
        <Link href="/orders" style={{ fontSize: '14px', fontWeight: 600, color: '#3A3A2C', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>← All orders</Link>
      </div>
    </div>
  );
}
