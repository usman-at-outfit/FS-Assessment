'use client';

import { useState, useEffect, useRef } from 'react';
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

// ─── Banner manager ───────────────────────────────────────────────────────────

function BannerManager({ token }: { token: string }) {
  const [images,    setImages]    = useState<string[]>([]);
  const [fetching,  setFetching]  = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg,       setMsg]       = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<{ images: string[] }>('/settings/banner')
      .then(r => setImages(r.images ?? []))
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  async function save(updated: string[]) {
    await api.withToken(token).put('/settings/banner', { images: updated });
    setImages(updated);
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    setMsg('');
    try {
      const form = new FormData();
      files.forEach(f => form.append('files', f));
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/uploads`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const uploaded: { url: string }[] = await res.json();
      const newUrls = uploaded.map(u => u.url);
      const updated = [...images, ...newUrls];
      await save(updated);
      setMsg(`${newUrls.length} image${newUrls.length > 1 ? 's' : ''} added`);
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeImage(idx: number) {
    const updated = images.filter((_, i) => i !== idx);
    try {
      await save(updated);
      setMsg('Removed');
    } catch {
      setMsg('Remove failed');
    }
  }

  const isError = msg.toLowerCase().includes('fail');

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', marginBottom: '28px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(58,58,44,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', textTransform: 'uppercase', marginBottom: '2px' }}>
            Hero banner slider
          </div>
          <div style={{ fontSize: '13px', color: '#6B6857' }}>
            {images.length === 0 ? 'No images — default gradient shown' : `${images.length} image${images.length > 1 ? 's' : ''} · auto-slides on storefront`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {msg && <span style={{ fontSize: '12px', fontWeight: 600, color: isError ? '#A82E22' : '#2E7D52' }}>{msg}</span>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple style={{ display: 'none' }} onChange={handleFiles} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading || fetching}
            style={{ fontSize: '13px', fontWeight: 600, padding: '8px 16px', borderRadius: '6px', background: '#43432B', color: '#FAF6EC', border: 'none', cursor: (uploading || fetching) ? 'not-allowed' : 'pointer', opacity: (uploading || fetching) ? 0.6 : 1 }}
          >
            {uploading ? 'Uploading…' : '+ Add images'}
          </button>
        </div>
      </div>

      {/* Thumbnails grid */}
      {!fetching && (
        images.length > 0 ? (
          <div style={{ padding: '16px 20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {images.map((url, idx) => (
              <div key={idx} style={{ position: 'relative', width: '160px', height: '100px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, border: '1px solid rgba(58,58,44,0.12)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Banner ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {/* Slide number */}
                <div style={{ position: 'absolute', top: '6px', left: '7px', background: 'rgba(0,0,0,0.50)', color: '#FFF', fontSize: '10px', fontFamily: "'Space Mono', monospace", padding: '2px 6px', borderRadius: '4px' }}>
                  {idx + 1}
                </div>
                {/* Remove button */}
                <button
                  onClick={() => removeImage(idx)}
                  title="Remove"
                  style={{ position: 'absolute', top: '5px', right: '5px', width: '22px', height: '22px', borderRadius: '50%', border: 'none', background: 'rgba(168,46,34,0.85)', color: '#FFF', fontSize: '12px', lineHeight: '22px', textAlign: 'center', cursor: 'pointer', padding: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(120deg,#d8d3bf,#b9bc92)' }}>
            <span style={{ fontSize: '13px', color: 'rgba(58,58,44,0.55)' }}>Upload images to activate the slider</span>
          </div>
        )
      )}
    </div>
  );
}

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
      {/* Banner manager */}
      {token && <BannerManager token={token} />}

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
