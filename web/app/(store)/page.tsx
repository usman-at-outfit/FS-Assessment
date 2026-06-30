import Link from 'next/link';
import { api, Category, Product, formatCents, pickThumb } from '@/lib/api-client';
import { HomeAddToCart } from '@/components/home-add-to-cart';
import { HeroSlider } from '@/components/hero-slider';
import { TypewriterTitle } from '@/components/typewriter-title';

async function getBestsellers(): Promise<Product[]> {
  try {
    const res = await api.products.list({ pageSize: 4, sort: 'newest' });
    return res.items;
  } catch {
    return [];
  }
}

async function getBannerImages(): Promise<string[]> {
  try {
    const res = await api.get<{ images: string[] }>('/settings/banner');
    return res.images ?? [];
  } catch {
    return [];
  }
}

async function getCategories(): Promise<Category[]> {
  try {
    return await api.categories.list();
  } catch {
    return [];
  }
}

const FALLBACK_BG = [
  'linear-gradient(135deg,#cfd0a6,#a9ad7c)',
  'linear-gradient(135deg,#c8cfb6,#9fa980)',
  'linear-gradient(135deg,#d2d0a2,#b0b079)',
  'linear-gradient(135deg,#c9cba3,#9ba370)',
  'linear-gradient(135deg,#d1cba0,#b2b07a)',
  'linear-gradient(135deg,#ccc9a8,#9ba47e)',
];

export default async function HomePage() {
  const [bestsellers, bannerImages, categories] = await Promise.all([getBestsellers(), getBannerImages(), getCategories()]);

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* ── Hero ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(120deg,#d8d3bf,#b9bc92)',
        height: 'calc(100vh - 90px)',
        minHeight: '500px',
        display: 'flex', alignItems: 'center',
      }}>
        {/* Banner slider (behind overlay) */}
        <HeroSlider images={bannerImages} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, rgba(28,28,18,.62) 0%, rgba(28,28,18,.30) 48%, rgba(28,28,18,0) 72%)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: '16px', padding: '0 clamp(24px,7%,90px)',
        }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', letterSpacing: '0.22em', color: '#EADFC8' }}>
            PLASTIC-FREE · MADE TO LAST
          </div>
          <TypewriterTitle style={{
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500,
            fontSize: 'clamp(28px,5.2vw,54px)', lineHeight: 1.04,
            color: '#FFFFFF', maxWidth: '600px', margin: 0,
          }} />
          <p style={{ fontSize: 'clamp(14px,1.6vw,17px)', color: 'rgba(255,255,255,.88)', maxWidth: '420px', margin: 0, lineHeight: 1.55 }}>
            Sustainable home goods designed to replace single-use plastic — beautifully made, built to last.
          </p>
          <div style={{ marginTop: '6px' }}>
            <Link
              href="/catalog"
              style={{
                display: 'inline-block', fontSize: '15px', fontWeight: 600,
                color: '#FAF6EC', background: '#43432B',
                border: '1px solid #43432B', padding: '13px 26px',
                borderRadius: '7px', textDecoration: 'none',
              }}
            >
              Shop all →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Shop by room ── */}
      <div style={{ padding: '36px 28px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '24px', margin: 0 }}>Shop by room</h2>
          <Link href="/catalog" style={{ fontSize: '13px', fontWeight: 600, color: '#43432B', textDecoration: 'none' }}>View all →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {categories.map((cat, i) => (
            <Link
              key={cat.slug}
              href={`/catalog?category=${cat.slug}`}
              style={{
                position: 'relative', borderRadius: '14px', overflow: 'hidden',
                textDecoration: 'none', display: 'block',
                boxShadow: '0 1px 3px rgba(0,0,0,.08)',
              }}
            >
              <div style={{
                width: '100%', height: '210px',
                background: cat.imageUrl ? undefined : FALLBACK_BG[i % FALLBACK_BG.length],
                position: 'relative',
              }}>
                {cat.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={cat.imageUrl}
                    alt={cat.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </div>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(0deg, rgba(28,28,18,.60), rgba(28,28,18,0) 58%)',
                display: 'flex', alignItems: 'flex-end', padding: '16px',
              }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 500, color: '#FFFFFF' }}>
                  {cat.name}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Bestsellers ── */}
      <div style={{ padding: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '24px', margin: 0 }}>Bestsellers</h2>
          <Link href="/catalog" style={{ fontSize: '13px', fontWeight: 600, color: '#43432B', textDecoration: 'none' }}>Browse all →</Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '18px' }}>
          {bestsellers.map(product => (
            <div
              key={product.id}
              style={{ border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '12px', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(0,0,0,.05)' }}
            >
              <Link href={`/products/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '8px', overflow: 'hidden', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pickThumb(product)} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '16px', fontWeight: 500, marginTop: '11px', color: '#3A3A2C' }}>{product.name}</div>
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '15px', fontWeight: 600, color: '#3A3A2C' }}>{formatCents(product.priceCents)}</span>
                <HomeAddToCart product={product} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
