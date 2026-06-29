'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { Product, formatCents } from '@/lib/api-client';

export function ProductActions({ product }: { product: Product }) {
  const { user }    = useAuth();
  const { addItem } = useCart();
  const router      = useRouter();
  const [qty,     setQty]     = useState(1);
  const [adding,  setAdding]  = useState(false);
  const [added,   setAdded]   = useState(false);

  if (user?.role === 'ADMIN') {
    return (
      <a href={`/admin/products`} style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        fontSize: '15px', fontWeight: 600, padding: '13px 24px', borderRadius: '6px',
        color: '#43432B', background: '#EFEDE1', border: '1px solid rgba(67,67,43,0.20)',
        textDecoration: 'none',
      }}>
        ✏️ Manage this product in Admin panel ↗
      </a>
    );
  }

  if (product.stock === 0) {
    return (
      <div style={{ background: '#F6E0DD', border: '1px solid #EFCBC6', color: '#8A241A', fontSize: '14px', fontWeight: 600, padding: '14px 16px', borderRadius: '8px' }}>
        Currently sold out — check back soon.
      </div>
    );
  }

  async function handleAdd() {
    if (!user) { router.push('/login'); return; }
    if (adding) return;
    setAdding(true);
    try {
      await addItem(product.id, qty);
      setAdded(true);
      setTimeout(() => setAdded(false), 2200);
    } finally {
      setAdding(false);
    }
  }

  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Qty picker */}
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(58,58,44,0.16)', borderRadius: '6px', overflow: 'hidden', background: '#FFFFFF' }}>
        <button
          onClick={() => setQty(q => Math.max(1, q - 1))}
          style={{ width: '42px', height: '44px', border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#6B6857' }}
        >−</button>
        <span style={{ width: '44px', textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: '15px', fontWeight: 600, color: '#3A3A2C' }}>
          {qty}
        </span>
        <button
          onClick={() => setQty(q => Math.min(product.stock, q + 1))}
          style={{ width: '42px', height: '44px', border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#6B6857' }}
        >+</button>
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAdd}
        disabled={adding}
        style={{
          flex: 1, minWidth: '180px', fontSize: '15px', fontWeight: 600,
          color: added ? '#2E7D52' : '#FAF6EC',
          background: added ? '#E3F0E8' : '#43432B',
          border: 'none', padding: '13px 24px', borderRadius: '6px',
          cursor: adding ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
        }}
      >
        {added ? 'Added to cart ✓' : adding ? 'Adding…' : `Add to cart — ${formatCents(product.priceCents * qty)}`}
      </button>
    </div>
  );
}
