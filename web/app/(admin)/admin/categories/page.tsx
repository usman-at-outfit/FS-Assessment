'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { api, ApiError, Category } from '@/lib/api-client';
import { ImageUploader } from '@/components/image-uploader';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ msg, onDone }: { msg: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)', background: '#3A3A2C', color: '#FAF6EC', fontSize: '13px', fontWeight: 600, padding: '10px 22px', borderRadius: '999px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 100 }}>
      {msg}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B6857', marginBottom: '6px', letterSpacing: '0.02em' }}>
        {label}
        {hint && <span style={{ fontWeight: 400, color: '#A39E8C', marginLeft: '6px' }}>{hint}</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: '11px', color: '#A82E22', marginTop: '4px' }}>{error}</div>}
    </div>
  );
}

// ─── Category drawer ──────────────────────────────────────────────────────────

interface DrawerProps {
  token: string;
  open: boolean;
  editing: Category | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

interface FormState { name: string; slug: string; imageUrl: string }
interface FormErrors extends Partial<Record<keyof FormState, string>> { _form?: string }

const EMPTY: FormState = { name: '', slug: '', imageUrl: '' };

function toSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function CategoryDrawer({ token, open, editing, onClose, onSaved }: DrawerProps) {
  const [form,   setForm]   = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({ name: editing.name, slug: editing.slug, imageUrl: editing.imageUrl ?? '' });
      setSlugEdited(true);
    } else {
      setForm(EMPTY);
      setSlugEdited(false);
    }
    setErrors({});
  }, [editing, open]);

  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      name,
      slug: slugEdited ? f.slug : toSlug(name),
    }));
  }

  function handleSlugChange(slug: string) {
    setSlugEdited(true);
    setForm(f => ({ ...f, slug }));
  }

  function validate(): boolean {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Required';
    if (!form.slug.trim()) e.slug = 'Required';
    else if (!/^[a-z0-9-]+$/.test(form.slug)) e.slug = 'Only lowercase letters, digits, and hyphens';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name:     form.name.trim(),
        slug:     form.slug.trim(),
        imageUrl: form.imageUrl || undefined,
      };
      if (editing) {
        await api.categories.update(editing.id, payload, token);
        onSaved('Category updated');
      } else {
        await api.categories.create(payload, token);
        onSaved('Category created');
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Save failed — try again.';
      setErrors({ _form: msg });
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const field: React.CSSProperties = {
    width: '100%', fontSize: '14px', background: '#FFFFFF',
    border: '1px solid rgba(58,58,44,0.16)', borderRadius: '6px',
    padding: '9px 12px', outline: 'none', color: '#3A3A2C',
    fontFamily: 'inherit', boxSizing: 'border-box',
  };
  const fieldErr = (hasErr?: string): React.CSSProperties => ({
    ...field,
    background: hasErr ? 'rgba(168,46,34,0.06)' : '#FFFFFF',
    border: `1px solid ${hasErr ? '#A82E22' : 'rgba(58,58,44,0.16)'}`,
  });

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 50 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: '#FFFFFF', boxShadow: '-12px 0 40px rgba(0,0,0,0.2)', zIndex: 60, display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(58,58,44,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', color: '#8A8676', marginBottom: '2px' }}>{editing ? 'EDITING' : 'CREATE'}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 500, color: '#3A3A2C' }}>{editing ? 'Edit category' : 'New category'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '18px', color: '#8A8676', cursor: 'pointer', padding: '4px' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {errors._form && (
            <div style={{ fontSize: '13px', color: '#8A241A', background: '#F6E0DD', border: '1px solid rgba(168,46,34,0.25)', borderRadius: '6px', padding: '10px 14px' }}>
              {errors._form}
            </div>
          )}

          <Field label="Name" error={errors.name}>
            <input
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Kitchen"
              style={fieldErr(errors.name)}
            />
          </Field>

          <Field label="Slug" error={errors.slug} hint="(used in URLs)">
            <input
              value={form.slug}
              onChange={e => handleSlugChange(e.target.value)}
              placeholder="kitchen"
              style={{ ...fieldErr(errors.slug), fontFamily: "'Space Mono', monospace", fontSize: '13px' }}
            />
          </Field>

          <Field label="Image" hint="(optional — shown on homepage)">
            {form.imageUrl && (
              <div style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(58,58,44,0.12)', height: '100px', position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => setForm(f => ({ ...f, imageUrl: '' }))}
                  style={{ position: 'absolute', top: '6px', right: '6px', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', padding: '3px 8px', cursor: 'pointer' }}
                >
                  Remove
                </button>
              </div>
            )}
            <ImageUploader
              token={token}
              value={[]}
              onChange={urls => { if (urls.length) setForm(f => ({ ...f, imageUrl: urls[urls.length - 1] })); }}
              max={1}
            />
          </Field>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 22px', borderTop: '1px solid rgba(58,58,44,0.10)', display: 'flex', gap: '10px', flexShrink: 0, background: '#FFFFFF' }}>
          <button onClick={onClose} style={{ flex: 1, fontSize: '14px', fontWeight: 600, padding: '11px', borderRadius: '6px', cursor: 'pointer', background: '#FFFFFF', color: '#3A3A2C', border: '1px solid rgba(58,58,44,0.16)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, fontSize: '14px', fontWeight: 600, padding: '11px', borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#A39E8C' : '#43432B', color: '#FAF6EC', border: 'none' }}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create category'}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminCategoriesPage() {
  const { token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [toast,      setToast]      = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing,    setEditing]    = useState<Category | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await api.categories.list());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() { setEditing(null); setDrawerOpen(true); }
  function openEdit(c: Category) { setEditing(c); setDrawerOpen(true); }
  function closeDrawer() { setDrawerOpen(false); setEditing(null); }
  const clearToast = useCallback(() => setToast(''), []);

  function handleSaved(msg: string) {
    closeDrawer();
    setToast(msg);
    load().catch(() => {});
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#8A8676' }}>
          {loading ? '…' : `${categories.length} categor${categories.length !== 1 ? 'ies' : 'y'}`}
        </span>
        <button onClick={openCreate} style={{ fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', border: 'none', padding: '9px 18px', borderRadius: '6px', cursor: 'pointer' }}>
          + New category
        </button>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
        {/* Header row */}
        <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 90px', padding: '11px 22px', background: '#FBF8EF', borderBottom: '1px solid rgba(58,58,44,0.10)' }}>
          {['Image', 'Name', 'Slug', 'Actions'].map(h => (
            <div key={h} style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', textTransform: 'uppercase', color: '#8A8676' }}>{h}</div>
          ))}
        </div>

        {loading && (
          <div style={{ padding: '28px 22px', color: '#8A8676', fontSize: '14px' }}>Loading…</div>
        )}

        {!loading && categories.length === 0 && (
          <div style={{ padding: '48px 22px', textAlign: 'center', color: '#8A8676', fontSize: '14px' }}>
            No categories yet. Create one to get started.
          </div>
        )}

        {!loading && categories.map((cat, idx) => {
          const isLast = idx === categories.length - 1;
          return (
            <div
              key={cat.id}
              style={{ display: 'grid', gridTemplateColumns: '56px 1fr 1fr 90px', padding: '10px 22px', alignItems: 'center', borderBottom: isLast ? 'none' : '1px solid rgba(58,58,44,0.06)' }}
            >
              {/* Image thumbnail */}
              <div style={{ width: '40px', height: '40px', borderRadius: '6px', overflow: 'hidden', background: 'linear-gradient(135deg,#ECEAE2,#D5D0BC)', flexShrink: 0 }}>
                {cat.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cat.imageUrl} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#A39E8C' }}>{cat.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                )}
              </div>

              {/* Name */}
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '14px', fontWeight: 500, color: '#3A3A2C' }}>{cat.name}</div>

              {/* Slug */}
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#6B6857' }}>{cat.slug}</div>

              {/* Actions */}
              <div>
                <button
                  onClick={() => openEdit(cat)}
                  style={{ fontSize: '12px', fontWeight: 600, color: '#3A3A2C', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', padding: '5px 14px', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Drawer */}
      {token && (
        <CategoryDrawer
          token={token}
          open={drawerOpen}
          editing={editing}
          onClose={closeDrawer}
          onSaved={handleSaved}
        />
      )}

      {toast && <Toast msg={toast} onDone={clearToast} />}
    </>
  );
}
