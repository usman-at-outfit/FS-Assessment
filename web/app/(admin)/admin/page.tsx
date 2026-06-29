'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError, formatCents } from '@/lib/api-client';

interface AdminStats {
  totalSalesCents: number;
  ordersCount:     number;
  aovCents:        number;
  attentionCount:  number;
  statusCounts:    Record<string, number>;
  topProducts: {
    id:         number;
    name:       string;
    imageUrl:   string;
    unitsSold:  number;
    salesCents: number;
  }[];
}

const STATUS_ORDER = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const STATUS_COLORS: Record<string, string> = {
  PENDING:    '#8A8676',
  PROCESSING: '#B57A1A',
  SHIPPED:    '#2C6E9B',
  DELIVERED:  '#2E7D52',
  CANCELLED:  '#A82E22',
};

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ background: highlight ? '#FBF4E6' : '#FFFFFF', border: `1px solid ${highlight ? 'rgba(181,122,26,0.30)' : 'rgba(58,58,44,0.10)'}`, borderRadius: '10px', padding: '20px 22px' } as React.CSSProperties}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', marginBottom: '10px', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: mono ? "'Space Mono', monospace" : "'Space Grotesk', sans-serif", fontSize: '26px', fontWeight: mono ? 700 : 500, color: highlight ? '#8A5A0F' : '#3A3A2C' }}>{value}</div>
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.14)', borderRadius: '8px', padding: '8px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)', fontSize: '12px' }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: '#3A3A2C', marginBottom: '3px' }}>{label}</div>
      <div style={{ color: '#6B6857' }}>{payload[0].value} order{payload[0].value !== 1 ? 's' : ''}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats,   setStats]   = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.withToken(token).get<AdminStats>('/admin/stats')
      .then(setStats)
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load stats'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div style={{ color: '#8A8676', fontSize: '14px', padding: '20px 0' }}>Loading…</div>;
  if (error)   return <div style={{ color: '#8A241A', background: '#F6E0DD', borderRadius: '6px', padding: '14px', fontSize: '13px' }}>{error}</div>;
  if (!stats)  return null;

  // Chart data — all statuses present in data
  const chartData = STATUS_ORDER
    .filter(s => (stats.statusCounts[s] ?? 0) > 0)
    .map(s => ({ status: s, count: stats.statusCounts[s] ?? 0 }));

  // Top product bar widths (relative to max)
  const maxUnits = Math.max(...stats.topProducts.map(p => p.unitsSold), 1);

  return (
    <>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        <StatCard label="Total revenue" value={formatCents(stats.totalSalesCents)} mono />
        <StatCard label="Total orders"  value={String(stats.ordersCount)} />
        <StatCard label="Avg. order (delivered)" value={stats.aovCents ? formatCents(stats.aovCents) : '—'} mono />
        <StatCard label="Needs attention" value={String(stats.attentionCount)} highlight={stats.attentionCount > 0} />
      </div>

      {/* Two-column layout: chart + top products */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '22px', alignItems: 'start' }}>
        {/* Orders-by-status bar chart */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', padding: '20px 22px' }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', textTransform: 'uppercase', marginBottom: '18px' }}>Orders by status</div>
          {chartData.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#8A8676', padding: '20px 0' }}>No orders yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barSize={32} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                <XAxis
                  dataKey="status"
                  tick={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fill: '#8A8676' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fill: '#8A8676' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(58,58,44,0.05)' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map(entry => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#8A8676'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top-selling products */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', padding: '20px 22px' }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', textTransform: 'uppercase', marginBottom: '18px' }}>Top-selling products</div>
          {stats.topProducts.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#8A8676', padding: '8px 0' }}>No sales yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.topProducts.map((p, i) => (
                <div key={p.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', color: '#A39E8C', width: '16px', flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ width: '24px', height: '24px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#ECEAE2,#FFFFFF)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <span style={{ fontSize: '13px', color: '#3A3A2C', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', color: '#6B6857', flexShrink: 0 }}>{p.unitsSold} sold</span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginLeft: '48px', height: '4px', borderRadius: '999px', background: 'rgba(58,58,44,0.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: '999px', background: '#43432B', width: `${Math.round((p.unitsSold / maxUnits) * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
