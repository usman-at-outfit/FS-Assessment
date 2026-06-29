'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError, Product, Category, formatCents, pickThumb } from '@/lib/api-client';
import { ImageUploader } from '@/components/image-uploader';

// ─── Stock badge ──────────────────────────────────────────────────────────────

function StockBadge({ stock }: { stock: number }) {
  const cfg =
    stock === 0 ? { bg: '#F6E0DD', color: '#8A241A', dot: '#A82E22', label: 'Out of stock' } :
    stock <= 5   ? { bg: '#F7ECD6', color: '#8A5A0F', dot: '#B57A1A', label: `Low · ${stock}` } :
                   { bg: '#E3F0E8', color: '#1F5C3B', dot: '#2E7D52', label: `In stock · ${stock}` };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, padding: '3px 9px', borderRadius: '999px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: '#3A3A2C', color: '#FAF6EC', fontSize: '13px', fontWeight: 600, padding: '10px 22px', borderRadius: '999px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100 }}>
      {msg}
    </div>
  );
}

// ─── Product form drawer ──────────────────────────────────────────────────────

interface FormState { name: string; description: string; price: string; stock: string; categoryId: string; imageUrls: string[] }
const EMPTY_FORM: FormState = { name: '', description: '', price: '', stock: '', categoryId: '', imageUrls: [] };
interface FormErrors extends Partial<Record<keyof FormState, string>> { _form?: string }

interface DrawerProps {
  token: string;
  open: boolean;
  editing: Product | null;
  categories: Category[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}

function ProductDrawer({ token, open, editing, categories, onClose, onSaved }: DrawerProps) {
  const [form,   setForm]   = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      const imgs = editing.images && editing.images.length > 0
        ? editing.images.map(i => i.url)
        : editing.imageUrl ? [editing.imageUrl] : [];
      setForm({
        name:        editing.name,
        description: editing.description,
        price:       (editing.priceCents / 100).toFixed(2),
        stock:       String(editing.stock),
        categoryId:  String(editing.categoryId),
        imageUrls:   imgs,
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [editing, open]);

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim())        e.name        = 'Required';
    if (!form.description.trim()) e.description = 'Required';
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) e.price = 'Enter a price above 0';
    if (!/^\d+$/.test(form.stock)) e.stock = 'Whole number, 0 or more';
    if (!form.categoryId) e.categoryId = 'Select a category';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name:        form.name.trim(),
        description: form.description.trim(),
        priceCents:  Math.round(parseFloat(form.price) * 100),
        stock:       parseInt(form.stock, 10),
        categoryId:  parseInt(form.categoryId, 10),
        imageUrls:   form.imageUrls,
      };
      if (editing) {
        await api.withToken(token).patch(`/products/${editing.id}`, payload);
        onSaved(`Product updated`);
      } else {
        await api.withToken(token).post('/products', payload);
        onSaved('Product created');
      }
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Save failed — try again.';
      setErrors({ _form: msg });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const fieldStyle = (hasErr?: string): React.CSSProperties => ({
    width: '100%', fontSize: '14px',
    background: hasErr ? 'rgba(168,46,34,0.06)' : '#FFFFFF',
    border: `1px solid ${hasErr ? '#A82E22' : 'rgba(58,58,44,0.16)'}`,
    borderRadius: '6px', padding: '9px 12px', outline: 'none',
    color: '#3A3A2C', fontFamily: 'inherit', boxSizing: 'border-box',
  } as React.CSSProperties);

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      {/* Drawer */}
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', background: '#FFFFFF', boxShadow: '-12px 0 40px rgba(0,0,0,0.2)', zIndex: 60, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(58,58,44,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', color: '#8A8676', marginBottom: '2px' }}>{editing ? 'EDITING' : 'CREATE'}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 500, color: '#3A3A2C' }}>{editing ? 'Edit product' : 'New product'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#8A8676', cursor: 'pointer', padding: '4px' }}>✕</button>
        </div>

        {/* Body (scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errors._form && (
            <div style={{ fontSize: '13px', color: '#8A241A', background: '#F6E0DD', border: '1px solid rgba(168,46,34,0.25)', borderRadius: '6px', padding: '10px 14px' }}>
              {errors._form}
            </div>
          )}
          <Field label="Product name" error={errors.name}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Bamboo Cutting Board" style={fieldStyle(errors.name)} />
          </Field>

          <Field label="Description" error={errors.description}>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Short editorial description…" rows={3} style={{ ...fieldStyle(), resize: 'vertical' }} />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Price (USD)" error={errors.price}>
              <input value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="24.99" style={{ ...fieldStyle(errors.price), fontFamily: "'Space Mono', monospace" }} />
            </Field>
            <Field label="Stock" error={errors.stock}>
              <input value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} placeholder="50" style={{ ...fieldStyle(errors.stock), fontFamily: "'Space Mono', monospace" }} />
            </Field>
          </div>

          <Field label="Category" error={errors.categoryId}>
            <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} style={{ ...fieldStyle(errors.categoryId), appearance: 'none', cursor: 'pointer' }}>
              <option value="">Select category…</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Images" error={undefined}>
            <ImageUploader token={token} value={form.imageUrls} onChange={urls => setForm(f => ({ ...f, imageUrls: urls }))} max={8} />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid rgba(58,58,44,0.10)', display: 'flex', gap: '10px', flexShrink: 0, background: '#FFFFFF' }}>
          <button onClick={onClose} style={{ flex: 1, fontSize: '14px', fontWeight: 600, padding: '11px', borderRadius: '6px', cursor: 'pointer', background: '#FFFFFF', color: '#3A3A2C', border: '1px solid rgba(58,58,44,0.16)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, fontSize: '14px', fontWeight: 600, padding: '11px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#A39E8C' : '#43432B', color: '#FAF6EC', border: 'none' }}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B6857', marginBottom: '6px', letterSpacing: '0.02em' }}>{label}</label>
      {children}
      {error && <div style={{ fontSize: '11px', color: '#A82E22', marginTop: '4px' }}>{error}</div>}
    </div>
  );
}

// ─── Delete confirm modal ─────────────────────────────────────────────────────

function DeleteModal({ product, onConfirm, onCancel, deleting }: { product: Product; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 70 }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '380px', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.35)', padding: '28px', zIndex: 80 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 500, color: '#3A3A2C', marginBottom: '10px' }}>Delete product?</div>
        <p style={{ fontSize: '14px', color: '#6B6857', margin: '0 0 24px', lineHeight: 1.6 }}>
          <strong>&#39;{product.name}&#39;</strong> will be permanently removed from the catalog. This can&apos;t be undone.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', fontSize: '14px', fontWeight: 600, borderRadius: '6px', background: '#FFFFFF', color: '#3A3A2C', border: '1px solid rgba(58,58,44,0.16)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} disabled={deleting} style={{ flex: 1, padding: '11px', fontSize: '14px', fontWeight: 600, borderRadius: '6px', background: deleting ? '#F6E0DD' : '#A82E22', color: '#FFFFFF', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── View toggle ─────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'grid';

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (mode: ViewMode, icon: React.ReactNode, label: string) => (
    <button
      title={label}
      onClick={() => onChange(mode)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer',
        border: `1px solid ${value === mode ? 'rgba(58,58,44,0.30)' : 'rgba(58,58,44,0.12)'}`,
        background: value === mode ? '#43432B' : '#FFFFFF',
        color: value === mode ? '#FAF6EC' : '#6B6857',
        transition: 'all 0.15s',
      }}
    >
      {icon}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: '4px' }}>
      {btn('list',
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="2" width="12" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="6.25" width="12" height="1.5" rx="0.75" fill="currentColor"/>
          <rect x="1" y="10.5" width="12" height="1.5" rx="0.75" fill="currentColor"/>
        </svg>,
        'List view'
      )}
      {btn('grid',
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="1" y="1" width="5" height="5" rx="1" fill="currentColor"/>
          <rect x="8" y="1" width="5" height="5" rx="1" fill="currentColor"/>
          <rect x="1" y="8" width="5" height="5" rx="1" fill="currentColor"/>
          <rect x="8" y="8" width="5" height="5" rx="1" fill="currentColor"/>
        </svg>,
        'Grid view'
      )}
    </div>
  );
}

// ─── Grid card ────────────────────────────────────────────────────────────────

interface CardProps {
  product: Product;
  catName: string;
  editLoading: boolean;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
}

function ProductCard({ product: p, catName, editLoading, onEdit, onDelete }: CardProps) {
  const thumbUrl = pickThumb(p);
  return (
    <div
      style={{
        background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px',
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 18px rgba(58,58,44,0.12)')}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      {/* Image */}
      <div style={{ width: '100%', aspectRatio: '4/3', background: 'linear-gradient(135deg,#ECEAE2,#FFFFFF)', overflow: 'hidden', flexShrink: 0 }}>
        {thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px', fontWeight: 700, color: '#C8C4B4' }}>{p.name.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 600, color: '#3A3A2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
        <div style={{ fontSize: '11px', color: '#8A8676' }}>{catName || '—'}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 700, color: '#3A3A2C' }}>{formatCents(p.priceCents)}</span>
          <StockBadge stock={p.stock} />
        </div>
      </div>

      {/* Actions */}
      <div
        style={{ padding: '10px 14px', borderTop: '1px solid rgba(58,58,44,0.07)', display: 'flex', gap: '6px' }}
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => onEdit(p)}
          disabled={editLoading}
          style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#3A3A2C', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', padding: '6px 0', borderRadius: '5px', cursor: editLoading ? 'not-allowed' : 'pointer', opacity: editLoading ? 0.5 : 1 }}
        >
          {editLoading ? '…' : 'Edit'}
        </button>
        <button
          onClick={() => onDelete(p)}
          style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '5px', border: '1px solid rgba(168,46,34,0.20)', background: '#FFFFFF', color: '#A82E22', cursor: 'pointer' }}
        >
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminProductsPage() {
  const { token } = useAuth();
  const [products,   setProducts]   = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState('');
  const [viewMode,   setViewMode]   = useState<ViewMode>('list');

  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [editing,      setEditing]      = useState<Product | null>(null);
  const [editLoading,  setEditLoading]  = useState(false);
  const [deleting,     setDeleting]     = useState<Product | null>(null);
  const [delInFlight,  setDelInFlight]  = useState(false);
  const [truncated,    setTruncated]    = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Use authenticated call — token gates write endpoints and avoids any future per-role filtering
      const [p, c] = await Promise.all([
        api.withToken(token).get<{ items: Product[]; total: number; page: number; pageSize: number }>('/products?pageSize=500&sort=newest'),
        api.categories.list(),
      ]);
      setProducts(p.items);
      setTruncated(p.total > p.items.length);
      setCategories(c);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setDrawerOpen(true); }

  async function openEdit(p: Product) {
    if (!token) return;
    setEditLoading(true);
    try {
      const fresh = await api.withToken(token).get<Product>(`/products/${p.id}`);
      setEditing(fresh);
    } catch {
      // fall back to list data if fetch fails
      setEditing(p);
    } finally {
      setEditLoading(false);
      setDrawerOpen(true);
    }
  }

  function closeDrawer() { setDrawerOpen(false); setEditing(null); }

  const clearToast = useCallback(() => setToast(''), []);

  function handleSaved(msg: string) {
    closeDrawer();
    setToast(msg);
    load().catch(() => setToast('Saved, but refresh failed — reload the page.'));
  }

  async function confirmDelete() {
    if (!deleting || !token) return;
    setDelInFlight(true);
    try {
      await api.withToken(token).delete(`/products/${deleting.id}`);
      setToast('Product deleted');
      setDeleting(null);
      load().catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Delete failed';
      setToast(msg);
      setDeleting(null);
    } finally {
      setDelInFlight(false);
    }
  }

  const catMap = Object.fromEntries(categories.map(c => [String(c.id), c.name]));

  return (
    <>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#8A8676' }}>
          {loading ? '…' : `${products.length} product${products.length !== 1 ? 's' : ''}`}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ViewToggle value={viewMode} onChange={setViewMode} />
          <button onClick={openCreate} style={{ fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', border: 'none', padding: '9px 18px', borderRadius: '6px', cursor: 'pointer' }}>
            + New product
          </button>
        </div>
      </div>

      {/* Truncation warning (>500 products) */}
      {truncated && (
        <div style={{ marginBottom: '14px', fontSize: '12px', color: '#8A5A0F', background: '#F7ECD6', border: '1px solid rgba(181,122,26,0.25)', borderRadius: '6px', padding: '8px 14px' }}>
          Showing first 500 products. Use search to find others.
        </div>
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 120px', padding: '11px 22px', background: '#FBF8EF', borderBottom: '1px solid rgba(58,58,44,0.10)' }}>
            {['Product', 'Category', 'Price', 'Stock', 'Actions'].map(h => (
              <div key={h} style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: '#8A8676' }}>{h}</div>
            ))}
          </div>

          {loading && (
            <div style={{ padding: '28px 22px', color: '#8A8676', fontSize: '14px' }}>Loading…</div>
          )}

          {!loading && products.length === 0 && (
            <div style={{ padding: '40px 22px', textAlign: 'center', color: '#8A8676', fontSize: '14px' }}>
              No products yet. Create one to get started.
            </div>
          )}

          {!loading && products.map((p, idx) => {
            const thumbUrl = pickThumb(p);
            const isLast = idx === products.length - 1;
            return (
              <div
                key={p.id}
                style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.2fr 120px', padding: '9px 22px', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid rgba(58,58,44,0.06)' }}
              >
                {/* Product */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#ECEAE2,#FFFFFF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={p.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : (
                      <span style={{ fontSize: '9px', fontWeight: 600, color: '#8A8676', textAlign: 'center', padding: '2px', lineHeight: 1.2 }}>
                        {p.name.slice(0, 3).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 500, color: '#3A3A2C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                  </div>
                </div>
                {/* Category */}
                <div style={{ fontSize: '13px', color: '#6B6857' }}>{catMap[p.categoryId] ?? '—'}</div>
                {/* Price */}
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>{formatCents(p.priceCents)}</div>
                {/* Stock */}
                <div><StockBadge stock={p.stock} /></div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => openEdit(p)}
                    disabled={editLoading}
                    style={{ fontSize: '12px', fontWeight: 600, color: '#3A3A2C', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', padding: '5px 12px', borderRadius: '5px', cursor: editLoading ? 'not-allowed' : 'pointer', opacity: editLoading ? 0.5 : 1 }}
                  >
                    {editLoading ? '…' : 'Edit'}
                  </button>
                  <button onClick={() => setDeleting(p)} style={{ fontSize: '12px', padding: '5px 10px', borderRadius: '5px', border: '1px solid rgba(168,46,34,0.20)', background: '#FFFFFF', color: '#A82E22', cursor: 'pointer' }}>🗑</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Grid view */}
      {viewMode === 'grid' && (
        <>
          {loading && (
            <div style={{ padding: '28px 0', color: '#8A8676', fontSize: '14px' }}>Loading…</div>
          )}
          {!loading && products.length === 0 && (
            <div style={{ padding: '60px 0', textAlign: 'center', color: '#8A8676', fontSize: '14px' }}>
              No products yet. Create one to get started.
            </div>
          )}
          {!loading && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '16px' }}>
              {products.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  catName={catMap[p.categoryId] ?? '—'}
                  editLoading={editLoading}
                  onEdit={openEdit}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Drawer */}
      {token && (
        <ProductDrawer
          token={token}
          open={drawerOpen}
          editing={editing}
          categories={categories}
          onClose={closeDrawer}
          onSaved={handleSaved}
        />
      )}

      {/* Delete confirm */}
      {deleting && (
        <DeleteModal
          product={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
          deleting={delInFlight}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={clearToast} />}
    </>
  );
}
