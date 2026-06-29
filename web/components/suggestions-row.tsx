import Link from 'next/link';
import { Product, formatCents, pickThumb } from '@/lib/api-client';

export function SuggestionsRow({ products }: { products: Product[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '18px' }}>
      {products.slice(0, 4).map(p => (
        <Link
          key={p.id}
          href={`/products/${p.id}`}
          style={{ border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '12px', background: '#FFFFFF', textDecoration: 'none', color: 'inherit', display: 'block' }}
        >
          <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pickThumb(p)} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '16px', fontWeight: 500, marginTop: '11px', color: '#3A3A2C' }}>{p.name}</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '14px', fontWeight: 600, marginTop: '6px', color: '#3A3A2C' }}>{formatCents(p.priceCents)}</div>
        </Link>
      ))}
    </div>
  );
}
