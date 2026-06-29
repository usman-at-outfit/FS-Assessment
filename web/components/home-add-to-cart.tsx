'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { Product } from '@/lib/api-client';

export function HomeAddToCart({ product }: { product: Product }) {
  const { user }    = useAuth();
  const { addItem } = useCart();
  const router      = useRouter();
  const [adding, setAdding] = useState(false);
  const [added,  setAdded]  = useState(false);

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) { router.push('/login'); return; }
    if (adding || product.stock === 0) return;
    setAdding(true);
    try {
      await addItem(product.id, 1);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setAdding(false);
    }
  }

  if (user?.role === 'ADMIN') {
    return (
      <a href="/admin/products" style={{
        fontSize: '13px', fontWeight: 600, padding: '7px 14px', borderRadius: '6px',
        color: '#43432B', background: '#EFEDE1', border: '1px solid rgba(67,67,43,0.20)',
        textDecoration: 'none', display: 'inline-block',
      }}>
        Edit products ↗
      </a>
    );
  }

  const outOfStock = product.stock === 0;
  const label = outOfStock ? 'Out of stock' : adding ? 'Adding…' : added ? 'Added ✓' : 'Add to cart';

  return (
    <button
      onClick={handleAdd}
      disabled={outOfStock || adding}
      style={{
        fontSize: '13px', fontWeight: 600, padding: '7px 14px', borderRadius: '6px',
        cursor: outOfStock || adding ? 'not-allowed' : 'pointer',
        color: added ? '#2E7D52' : outOfStock ? '#8A8676' : '#FAF6EC',
        background: added ? '#E3F0E8' : outOfStock ? '#F5F5F0' : '#43432B',
        border: 'none',
        transition: 'all 0.15s ease',
      }}
    >
      {label}
    </button>
  );
}
