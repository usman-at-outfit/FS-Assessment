'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/cart-context';
import { useAuth } from '@/contexts/auth-context';
import { formatCents, pickThumb } from '@/lib/api-client';
import { SHIPPING_CENTS, FREE_SHIP_THRESHOLD } from '@/lib/constants';

export default function CartPage() {
  const { user }    = useAuth();
  const { cart, addItem, removeItem, loading } = useCart();
  const router      = useRouter();

  const items = cart?.items ?? [];
  const subtotal = items.reduce((s, i) => s + i.product.priceCents * i.quantity, 0);
  const shipping  = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_CENTS;
  const total     = subtotal + shipping;

  async function handleQty(productId: number, qty: number) {
    if (qty < 1) {
      await removeItem(productId);
    } else {
      await addItem(productId, qty);
    }
  }

  if (!user) {
    return (
      <div style={{ padding: '60px 28px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', marginBottom: '8px' }}>Sign in to see your cart</div>
        <div style={{ fontSize: '14px', color: '#8A8676', marginBottom: '20px' }}>Your cart is saved to your account.</div>
        <Link href="/login" style={{ display: 'inline-block', fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', border: 'none', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px' }}>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '32px', margin: '0 0 22px', color: '#3A3A2C' }}>Your cart</h1>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 20px', background: '#FFFFFF', border: '1px dashed rgba(58,58,44,0.16)', borderRadius: '12px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', marginBottom: '6px' }}>Your cart is empty</div>
          <div style={{ fontSize: '14px', color: '#8A8676', marginBottom: '20px' }}>Once you add something, it'll show up here.</div>
          <Link href="/catalog" style={{ display: 'inline-block', fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>Browse the shop</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
          {/* Cart items */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', overflow: 'hidden' }}>
            {items.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '16px', borderBottom: '1px solid rgba(58,58,44,0.06)' }}>
                <div style={{ width: '66px', height: '66px', borderRadius: '8px', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={pickThumb(item.product)} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '17px', fontWeight: 500, color: '#3A3A2C' }}>{item.product.name}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', color: '#8A8676', marginTop: '3px' }}>{formatCents(item.product.priceCents)} each</div>
                </div>
                {/* Qty controls */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid rgba(58,58,44,0.16)', borderRadius: '6px', overflow: 'hidden', background: '#FFFFFF' }}>
                  <button onClick={() => handleQty(item.productId, item.quantity - 1)} style={{ width: '32px', height: '34px', border: 'none', background: 'transparent', fontSize: '16px', cursor: 'pointer', color: '#6B6857' }}>−</button>
                  <span style={{ width: '34px', textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#3A3A2C' }}>{item.quantity}</span>
                  <button onClick={() => handleQty(item.productId, item.quantity + 1)} style={{ width: '32px', height: '34px', border: 'none', background: 'transparent', fontSize: '16px', cursor: 'pointer', color: '#6B6857' }}>+</button>
                </div>
                <div style={{ width: '78px', textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: '14px', fontWeight: 600, color: '#3A3A2C' }}>
                  {formatCents(item.product.priceCents * item.quantity)}
                </div>
                <button onClick={() => removeItem(item.productId)} style={{ background: 'transparent', border: 'none', color: '#A39E8C', fontSize: '16px', cursor: 'pointer', padding: '4px' }}>✕</button>
              </div>
            ))}
            <div style={{ padding: '14px 16px' }}>
              <Link href="/catalog" style={{ fontSize: '13px', fontWeight: 600, color: '#43432B', textDecoration: 'none' }}>← Continue shopping</Link>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '22px', position: 'sticky', top: '90px' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '19px', fontWeight: 500, marginBottom: '16px', color: '#3A3A2C' }}>Order summary</div>
            <Row label="Subtotal" value={formatCents(subtotal)} />
            <Row label="Shipping" value={shipping === 0 ? 'Free' : formatCents(shipping)} valueStyle={{ color: shipping === 0 ? '#2E7D52' : '#3A3A2C' }} />
            {shipping > 0 && (
              <div style={{ fontSize: '12px', color: '#8A8676', marginTop: '-6px', marginBottom: '10px' }}>
                Add {formatCents(FREE_SHIP_THRESHOLD - subtotal)} for free shipping
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: '16px', fontWeight: 700, marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(58,58,44,0.12)', color: '#3A3A2C' }}>
              <span>Total</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '20px' }}>{formatCents(total)}</span>
            </div>
            <Link
              href="/checkout"
              style={{ display: 'block', width: '100%', fontSize: '15px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', border: 'none', padding: '13px', borderRadius: '6px', cursor: 'pointer', marginTop: '18px', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}
            >
              Checkout
            </Link>
            <div style={{ fontSize: '12px', color: '#8A8676', textAlign: 'center', marginTop: '10px' }}>Secure checkout · test mode</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueStyle }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#6B6857', marginBottom: '10px' }}>
      <span>{label}</span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, ...valueStyle }}>{value}</span>
    </div>
  );
}
