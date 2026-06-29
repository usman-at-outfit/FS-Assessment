'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Product, Category, formatCents } from '@/lib/api-client';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';

const PAGE_SIZE = 12;

function AddButton({ product }: { product: Product }) {
  const { user }    = useAuth();
  const { addItem } = useCart();
  const router      = useRouter();
  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);

  async function handle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    if (!user) { router.push('/login'); return; }
    if (adding || product.stock === 0) return;
    setAdding(true);
    try {
      await addItem(product.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 1800);
    } finally {
      setAdding(false);
    }
  }

  const out = product.stock === 0;
  const label = out ? 'Out of stock' : adding ? 'Adding…' : added ? 'Added ✓' : 'Add to cart';

  return (
    <button onClick={handle} disabled={out || adding} style={{
      fontSize: '13px', fontWeight: 600, padding: '7px 14px', borderRadius: '6px',
      cursor: out || adding ? 'not-allowed' : 'pointer',
      color: added ? '#2E7D52' : out ? '#8A8676' : '#FAF6EC',
      background: added ? '#E3F0E8' : out ? '#F5F5F0' : '#43432B',
      border: 'none', transition: 'all 0.15s ease',
    }}>
      {label}
    </button>
  );
}

function CatalogInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const [products,   setProducts]   = useState<Product[]>([]);
  const [total,      setTotal]      = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading,    setLoading]    = useState(true);

  const [search,   setSearch]   = useState(searchParams.get('search')   ?? '');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [sort,     setSort]     = useState(searchParams.get('sort')     ?? 'newest');
  const [maxPrice, setMaxPrice] = useState(Number(searchParams.get('maxPrice') ?? 15000));
  const [page,     setPage]     = useState(Number(searchParams.get('page') ?? 1));

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Load categories once
  useEffect(() => {
    api.categories.list().then(setCategories).catch(() => {});
  }, []);

  // Debounced fetch
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.products.list({
        search:   search || undefined,
        category: category || undefined,
        maxPrice: maxPrice < 15000 ? maxPrice : undefined,
        sort,
        page,
        pageSize: PAGE_SIZE,
      });
      setProducts(res.items);
      setTotal(res.total);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [search, category, sort, maxPrice, page]);

  useEffect(() => {
    const id = setTimeout(fetchProducts, 300);
    return () => clearTimeout(id);
  }, [fetchProducts]);

  function clearFilters() {
    setSearch(''); setCategory(''); setSort('newest'); setMaxPrice(15000); setPage(1);
  }

  const priceLabelCents = maxPrice < 15000 ? `Up to ${formatCents(maxPrice)}` : 'Any price';

  return (
    <div style={{ padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '20px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#43432B', marginBottom: '6px' }}>The shop</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '34px', margin: 0, letterSpacing: '-0.01em' }}>Everyday goods, made to last</h1>
        </div>
        <div style={{ fontSize: '13px', color: '#8A8676' }}>{loading ? '…' : `${total} product${total !== 1 ? 's' : ''}`}</div>
      </div>

      {/* Controls */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '16px 18px', marginBottom: '22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name…"
              style={{ width: '100%', fontSize: '14px', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', borderRadius: '6px', padding: '9px 12px 9px 32px', outline: 'none', color: '#3A3A2C', fontFamily: 'inherit' }}
            />
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8A8676' }}>⌕</span>
          </div>
          {/* Sort */}
          <div style={{ position: 'relative' }}>
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1); }}
              style={{ fontSize: '14px', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', borderRadius: '6px', padding: '9px 34px 9px 12px', appearance: 'none', cursor: 'pointer', color: '#3A3A2C', fontFamily: 'inherit' }}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price · low to high</option>
              <option value="price_desc">Price · high to low</option>
            </select>
            <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#8A8676', fontSize: '11px' }}>▾</span>
          </div>
        </div>

        {/* Category + price */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
            <CategoryChip label="All" active={!category} onClick={() => { setCategory(''); setPage(1); }} />
            {categories.map(c => (
              <CategoryChip key={c.id} label={c.name} active={category === c.slug} onClick={() => { setCategory(c.slug); setPage(1); }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
            <span style={{ fontSize: '12px', color: '#8CA0C8', whiteSpace: 'nowrap' }}>{priceLabelCents}</span>
            <input
              type="range" min={0} max={15000} step={500}
              value={maxPrice}
              onChange={e => { setMaxPrice(Number(e.target.value)); setPage(1); }}
              style={{ flex: 1, accentColor: '#43432B', cursor: 'pointer' }}
            />
          </div>
        </div>
      </div>

      {/* Skeleton */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '18px' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '12px', background: '#FFFFFF' }}>
              <div style={{ height: '170px', borderRadius: '8px', background: '#EAE2D5', animation: 'pulse 1.4s ease-in-out infinite' }} />
              <div style={{ height: '11px', width: '40%', borderRadius: '4px', background: '#EAE2D5', margin: '14px 0 8px', animation: 'pulse 1.4s ease-in-out infinite' }} />
              <div style={{ height: '15px', width: '75%', borderRadius: '4px', background: '#EAE2D5', animation: 'pulse 1.4s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {!loading && products.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: '18px' }}>
          {products.map(p => (
            <div key={p.id} style={{ border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '12px', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}>
              <Link href={`/products/${p.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                <div style={{ position: 'relative', height: '170px', borderRadius: '8px', overflow: 'hidden', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', color: '#8A8676', margin: '13px 0 4px' }}>
                  {p.category.name.toUpperCase()}
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '17px', fontWeight: 500, lineHeight: 1.25, color: '#3A3A2C' }}>{p.name}</div>
                <div style={{ fontSize: '12px', fontWeight: 600, marginTop: '7px', color: p.stock > 0 ? '#2E7D52' : '#A82E22' }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '999px', background: p.stock > 0 ? '#2E7D52' : '#A82E22', marginRight: '5px', verticalAlign: 'middle' }} />
                  {p.stock > 0 ? 'In stock' : 'Out of stock'}
                </div>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '11px' }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '15px', fontWeight: 600, color: '#3A3A2C' }}>{formatCents(p.priceCents)}</span>
                <AddButton product={p} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && products.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 20px', background: '#FFFFFF', border: '1px dashed rgba(58,58,44,0.16)', borderRadius: '12px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px', marginBottom: '6px' }}>Nothing matches that</div>
          <div style={{ fontSize: '14px', color: '#8A8676', marginBottom: '18px' }}>Try a different search, category, or widen the price range.</div>
          <button onClick={clearFilters} style={{ fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Clear filters</button>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '28px' }}>
          <PageBtn disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</PageBtn>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
            <PageBtn key={n} active={n === page} onClick={() => setPage(n)}>{n}</PageBtn>
          ))}
          <PageBtn disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>→</PageBtn>
        </div>
      )}
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      fontSize: '13px', fontWeight: 600, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
      background: active ? '#EFEDE1' : '#FFFFFF',
      color: active ? '#3A3A2C' : '#6B6857',
      border: active ? '1px solid #6B6857' : '1px solid rgba(58,58,44,0.16)',
    }}>
      {label}
    </button>
  );
}

function PageBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      fontSize: '13px', fontWeight: 600, minWidth: '38px', padding: '8px 12px', borderRadius: '6px', cursor: disabled ? 'not-allowed' : 'pointer',
      background: active ? '#EFEDE1' : '#FFFFFF',
      color: active ? '#3A3A2C' : '#6B6857',
      border: active ? '1px solid #6B6857' : '1px solid rgba(58,58,44,0.16)',
      opacity: disabled ? 0.5 : 1,
    }}>
      {children}
    </button>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px', textAlign: 'center', color: '#8A8676' }}>Loading…</div>}>
      <CatalogInner />
    </Suspense>
  );
}
