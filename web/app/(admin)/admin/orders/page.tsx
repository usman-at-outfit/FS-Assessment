'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError, AdminOrder, AdminOrderListResponse, formatCents } from '@/lib/api-client';
import { statusPillStyle } from '@/lib/order-status';
import { useSetAttention } from '../layout';

const STATUS_OPTIONS = ['', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const { token }      = useAuth();
  const setAttention   = useSetAttention();

  const [data,       setData]       = useState<AdminOrderListResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (statusFilter) qs.set('status', statusFilter);

      // Fetch page + true attention count in parallel
      const [result, pendingResp, processingResp] = await Promise.all([
        api.withToken(token).get<AdminOrderListResponse>(`/orders/admin/all?${qs.toString()}`),
        api.withToken(token).get<AdminOrderListResponse>(`/orders/admin/all?status=PENDING&pageSize=1`),
        api.withToken(token).get<AdminOrderListResponse>(`/orders/admin/all?status=PROCESSING&pageSize=1`),
      ]);
      setData(result);
      setAttention(pendingResp.total + processingResp.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [token, page, statusFilter, setAttention]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filter changes
  useEffect(() => { setPage(1); }, [statusFilter]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#8A8676' }}>
          {loading ? '…' : `${data?.total ?? 0} order${data?.total !== 1 ? 's' : ''}`}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: '#6B6857', fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ fontSize: '13px', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(58,58,44,0.16)', background: '#FFFFFF', color: '#3A3A2C', cursor: 'pointer', outline: 'none' }}
          >
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s || 'All statuses'}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: '16px', fontSize: '13px', color: '#8A241A', background: '#F6E0DD', borderRadius: '6px', padding: '10px 14px' }}>{error}</div>
      )}

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1.4fr 130px 110px 90px 36px', padding: '11px 22px', background: '#FBF8EF', borderBottom: '1px solid rgba(58,58,44,0.10)' }}>
          {['Order', 'Customer', 'Items', 'Status', 'Date', 'Total', ''].map(h => (
            <div key={h} style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: '#8A8676' }}>{h}</div>
          ))}
        </div>

        {loading && <div style={{ padding: '28px 22px', color: '#8A8676', fontSize: '14px' }}>Loading…</div>}

        {!loading && data?.items.length === 0 && (
          <div style={{ padding: '40px 22px', textAlign: 'center', color: '#8A8676', fontSize: '14px' }}>
            No orders{statusFilter ? ` with status ${statusFilter}` : ''}.
          </div>
        )}

        {!loading && data?.items.map((order, idx) => {
          const isLast  = idx === (data.items.length - 1);
          const itemSum = order.items.reduce((s, i) => s + i.quantity, 0);
          const itemLabel = order.items.length === 1
            ? order.items[0].product.name
            : `${order.items[0].product.name} +${order.items.length - 1}`;
          return (
            <div key={order.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1.4fr 130px 110px 90px 36px', padding: '9px 22px', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid rgba(58,58,44,0.06)' }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>#{order.id}</div>
              <div style={{ fontSize: '13px', color: '#3A3A2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.user.email}</div>
              <div style={{ fontSize: '12px', color: '#6B6857', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={order.items.map(i => i.product.name).join(', ')}>
                {itemLabel} · {itemSum} unit{itemSum !== 1 ? 's' : ''}
              </div>
              <div>
                <span style={statusPillStyle(order.status)}>{order.status}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#6B6857' }}>
                {new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>
                {formatCents(order.totalCents)}
              </div>
              <Link href={`/admin/orders/${order.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#8A8676', textDecoration: 'none' }}>›</Link>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '22px' }}>
          <PaginBtn label="‹" disabled={page === 1} onClick={() => setPage(p => p - 1)} />
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(n => (
            <PaginBtn key={n} label={String(n)} active={n === page} onClick={() => setPage(n)} />
          ))}
          {totalPages > 7 && page < totalPages && <span style={{ fontSize: '13px', color: '#8A8676', alignSelf: 'center' }}>…{totalPages}</span>}
          <PaginBtn label="›" disabled={page === totalPages} onClick={() => setPage(p => p + 1)} />
        </div>
      )}
    </>
  );
}

function PaginBtn({ label, active, disabled, onClick }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: '13px', fontWeight: active ? 700 : 500,
        padding: '6px 12px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? '#43432B' : '#FFFFFF',
        color: active ? '#FAF6EC' : disabled ? '#C5C1B4' : '#3A3A2C',
        border: `1px solid ${active ? '#43432B' : 'rgba(58,58,44,0.16)'}`,
      }}
    >
      {label}
    </button>
  );
}
