'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError, AdminOrder, formatCents } from '@/lib/api-client';
import { statusPillStyle } from '@/lib/order-status';

// FE mirror of the BE state machine
const VALID_TRANSITIONS: Record<AdminOrder['status'], AdminOrder['status'][]> = {
  PENDING:    ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED',    'CANCELLED'],
  SHIPPED:    ['DELIVERED'],
  DELIVERED:  [],
  CANCELLED:  [],
};

const LIFECYCLE_STEPS: AdminOrder['status'][] = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'];

// ─── Lifecycle tracker ────────────────────────────────────────────────────────

function LifecycleTracker({ status }: { status: AdminOrder['status'] }) {
  const cancelled = status === 'CANCELLED';
  const activeIdx = LIFECYCLE_STEPS.indexOf(status as typeof LIFECYCLE_STEPS[number]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {LIFECYCLE_STEPS.map((step, i) => {
        const isDone   = !cancelled && activeIdx > i;
        const isActive = !cancelled && activeIdx === i;
        const dotColor = isDone ? '#2E7D52' : isActive ? '#43432B' : 'rgba(58,58,44,0.20)';
        const lineColor = isDone ? '#2E7D52' : 'rgba(58,58,44,0.12)';
        const isLast   = i === LIFECYCLE_STEPS.length - 1;
        return (
          <div key={step} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            {/* Dot + line column */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '999px', background: dotColor, marginTop: '3px', flexShrink: 0, transition: 'background 0.2s' }} />
              {!isLast && <div style={{ width: '2px', height: '28px', background: lineColor, transition: 'background 0.2s' }} />}
            </div>
            {/* Label */}
            <div style={{ paddingBottom: isLast ? 0 : '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: isActive ? 700 : 500, color: isActive ? '#3A3A2C' : isDone ? '#3A3A2C' : '#A39E8C' }}>{step}</div>
              {isActive && <div style={{ fontSize: '11px', color: '#6B6857', marginTop: '1px' }}>Current status</div>}
              {isDone && <div style={{ fontSize: '11px', color: '#6B6857', marginTop: '1px' }}>Completed</div>}
            </div>
          </div>
        );
      })}
      {cancelled && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
          <div style={{ width: '12px', height: '12px', borderRadius: '999px', background: '#A82E22', flexShrink: 0 }} />
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#8A241A' }}>CANCELLED</div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminOrderDetailPage() {
  const { id }     = useParams<{ id: string }>();
  const { token }  = useAuth();

  const [order,    setOrder]    = useState<AdminOrder | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [updating, setUpdating] = useState(false);
  const [toast,    setToast]    = useState('');

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.withToken(token).get<AdminOrder>(`/orders/admin/${id}`);
      setOrder(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load order');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  async function transition(newStatus: AdminOrder['status']) {
    if (!token || !order) return;
    setUpdating(true);
    try {
      // updateStatus returns ORDER_INCLUDE shape (no user field) — preserve user from current state
      const patch = await api.withToken(token).patch<Omit<AdminOrder, 'user'>>(`/orders/${order.id}/status`, { status: newStatus });
      setOrder(prev => prev ? { ...patch, user: prev.user } : prev);
      setToast(`Order marked as ${newStatus}`);
    } catch (err) {
      setToast(err instanceof ApiError ? err.message : 'Update failed');
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  if (loading) return <div style={{ color: '#8A8676', fontSize: '14px', padding: '20px 0' }}>Loading…</div>;
  if (error)   return (
    <div>
      <Link href="/admin/orders" style={{ fontSize: '13px', color: '#6B6857', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>‹ All orders</Link>
      <div style={{ color: '#8A241A', background: '#F6E0DD', borderRadius: '6px', padding: '14px', fontSize: '13px' }}>{error}</div>
    </div>
  );
  if (!order) return null;

  const subtotal = order.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);
  const shipping = Math.max(0, order.totalCents - subtotal);
  const nextSteps = VALID_TRANSITIONS[order.status];
  const isCancelable = nextSteps.includes('CANCELLED');
  const forwardSteps = nextSteps.filter(s => s !== 'CANCELLED');

  return (
    <>
      {/* Back link */}
      <Link href="/admin/orders" style={{ fontSize: '13px', color: '#6B6857', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>‹ All orders</Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '22px', alignItems: 'start' }}>
        {/* Left — order details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Heading */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', fontWeight: 500, color: '#3A3A2C', margin: 0 }}>Order #{order.id}</h1>
            <span style={statusPillStyle(order.status)}>{order.status}</span>
          </div>
          <div style={{ fontSize: '13px', color: '#6B6857' }}>
            Customer: <strong style={{ color: '#3A3A2C' }}>{order.user.email}</strong> · Placed {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>

          {/* Line items */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(58,58,44,0.08)', background: '#FBF8EF' }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', textTransform: 'uppercase' }}>Items</span>
            </div>
            {order.items.map((item, idx) => {
              const isLast = idx === order.items.length - 1;
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px', borderBottom: isLast ? 'none' : '1px solid rgba(58,58,44,0.06)' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#ECEAE2,#FFFFFF)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.product.imageUrl} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 500, color: '#3A3A2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.product.name}</div>
                    <div style={{ fontSize: '12px', color: '#6B6857', marginTop: '1px' }}>Qty {item.quantity} · {formatCents(item.unitPriceCents)} each</div>
                  </div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#3A3A2C', flexShrink: 0 }}>{formatCents(item.unitPriceCents * item.quantity)}</div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <TotalRow label="Subtotal" value={formatCents(subtotal)} />
            <TotalRow label="Shipping" value={shipping === 0 ? 'Free' : formatCents(shipping)} />
            <div style={{ height: '1px', background: 'rgba(58,58,44,0.10)', margin: '4px 0' }} />
            <TotalRow label="Total" value={formatCents(order.totalCents)} bold />
          </div>
        </div>

        {/* Right — lifecycle + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Lifecycle tracker */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', padding: '18px' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', textTransform: 'uppercase', marginBottom: '14px' }}>Lifecycle</div>
            <LifecycleTracker status={order.status} />
          </div>

          {/* Action buttons */}
          {nextSteps.length > 0 && (
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', textTransform: 'uppercase', marginBottom: '2px' }}>Actions</div>
              {forwardSteps.map(s => (
                <button
                  key={s}
                  onClick={() => transition(s)}
                  disabled={updating}
                  style={{ fontSize: '13px', fontWeight: 600, padding: '10px 16px', borderRadius: '6px', cursor: updating ? 'not-allowed' : 'pointer', background: updating ? '#A39E8C' : '#43432B', color: '#FAF6EC', border: 'none', textAlign: 'left' }}
                >
                  Mark as {s}
                </button>
              ))}
              {isCancelable && (
                <button
                  onClick={() => transition('CANCELLED')}
                  disabled={updating}
                  style={{ fontSize: '13px', fontWeight: 600, padding: '10px 16px', borderRadius: '6px', cursor: updating ? 'not-allowed' : 'pointer', background: '#FFFFFF', color: '#8A241A', border: '1px solid rgba(168,46,34,0.25)' }}
                >
                  Cancel order
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: '#3A3A2C', color: '#FAF6EC', fontSize: '13px', fontWeight: 600, padding: '10px 22px', borderRadius: '999px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100 }}>
          {toast}
        </div>
      )}
    </>
  );
}

function TotalRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: bold ? '15px' : '13px', fontWeight: bold ? 600 : 400, color: bold ? '#3A3A2C' : '#6B6857' }}>
      <span>{label}</span>
      <span style={{ fontFamily: "'Space Mono', monospace" }}>{value}</span>
    </div>
  );
}
