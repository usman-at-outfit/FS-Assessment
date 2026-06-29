import Link from 'next/link';
import { notFound } from 'next/navigation';
import { api, formatCents } from '@/lib/api-client';
import { ProductActions } from '@/components/product-actions';
import { SuggestionsRow } from '@/components/suggestions-row';
import { ProductGallery } from '@/components/product-gallery';

interface Props { params: Promise<{ id: string }> }

export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const productId = parseInt(id, 10);
  if (isNaN(productId)) notFound();

  let product;
  try {
    product = await api.products.get(productId);
  } catch {
    notFound();
  }

  const suggestions = await api.suggestions.get({ exclude: productId }).catch(() => []);

  const inStock = product.stock > 0;
  const galleryUrls = product.images && product.images.length > 0
    ? product.images.map(img => img.url)
    : [product.imageUrl];

  return (
    <div style={{ padding: '28px', maxWidth: '1100px', margin: '0 auto' }}>
      <Link href="/catalog" style={{ fontSize: '13px', color: '#8A8676', textDecoration: 'none', display: 'inline-block', marginBottom: '18px' }}>
        ← Back to shop
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', alignItems: 'start' }}>
        {/* Image / gallery */}
        <ProductGallery urls={galleryUrls} name={product.name} />

        {/* Details */}
        <div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.16em', color: '#8A8676', marginBottom: '8px' }}>
            {product.category.name.toUpperCase()}
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '36px', margin: '0 0 12px', lineHeight: 1.1, letterSpacing: '-0.01em', color: '#3A3A2C' }}>
            {product.name}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '22px', fontWeight: 600, color: '#3A3A2C' }}>
              {formatCents(product.priceCents)}
            </span>
            <span style={{ display: 'inline-flex', gap: '7px', alignItems: 'center', fontSize: '12px', fontWeight: 600, color: inStock ? '#2E7D52' : '#A82E22' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '999px', background: inStock ? '#2E7D52' : '#A82E22', display: 'inline-block' }} />
              {inStock ? `In stock (${product.stock} left)` : 'Out of stock'}
            </span>
          </div>

          <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#6B6857', margin: '0 0 26px', maxWidth: '46ch' }}>
            {product.description}
          </p>

          <ProductActions product={product} />

          <div style={{ display: 'flex', gap: '20px', marginTop: '26px', paddingTop: '20px', borderTop: '1px solid rgba(58,58,44,0.12)', fontSize: '12px', color: '#8CA0C8' }}>
            <span>↺ 30-day returns</span>
            <span>✦ Made to order</span>
            <span>⌂ Ships in 3–5 days</span>
          </div>
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ marginTop: '52px' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '24px', margin: '0 0 18px' }}>You might also like</h2>
          <SuggestionsRow products={suggestions} />
        </div>
      )}
    </div>
  );
}
