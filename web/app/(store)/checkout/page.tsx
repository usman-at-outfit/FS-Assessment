'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { useCart } from '@/contexts/cart-context';
import { api, ApiError, Order, formatCents } from '@/lib/api-client';
import { SHIPPING_CENTS, FREE_SHIP_THRESHOLD } from '@/lib/constants';

type Step    = 'info' | 'payment' | 'done';
type PayTab  = 'card' | 'stripe';

interface ShipInfo { name: string; email: string; addr: string; city: string; zip: string }
interface PayInfo  { card: string; exp: string; cvc: string; name: string }

export default function CheckoutPage() {
  const { user, token } = useAuth();
  const { cart, clear } = useCart();
  const router          = useRouter();

  const [step,     setStep]     = useState<Step>('info');
  const [payTab,   setPayTab]   = useState<PayTab>('card');
  const [shipInfo, setShipInfo] = useState<ShipInfo>({ name: '', email: user?.email ?? '', addr: '', city: '', zip: '' });
  const [payInfo,  setPayInfo]  = useState<PayInfo>({ card: '', exp: '', cvc: '', name: '' });
  const [shipErrs, setShipErrs] = useState<Partial<ShipInfo>>({});
  const [payErrs,  setPayErrs]  = useState<Partial<PayInfo>>({});
  const [placing,  setPlacing]  = useState(false);
  const [stripeRedirecting, setStripeRedirecting] = useState(false);
  const [order,    setOrder]    = useState<Order | null>(null);
  const [formErr,  setFormErr]  = useState('');

  const items    = cart?.items ?? [];
  const subtotal = items.reduce((s, i) => s + i.product.priceCents * i.quantity, 0);
  const shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_CENTS;
  const total    = subtotal + shipping;

  // Handle Stripe return (success or cancel)
  useEffect(() => {
    if (typeof window === 'undefined' || !token) return;
    const qs         = new URLSearchParams(window.location.search);
    const sessionId  = qs.get('session_id');
    const canceled   = qs.get('canceled');

    if (sessionId) {
      // Confirm the Stripe payment and create the order
      setPlacing(true);
      api.withToken(token).post<Order>('/orders/checkout/confirm', { sessionId })
        .then(o => { setOrder(o); clear(); setStep('done'); })
        .catch(err => {
          const msg = err instanceof ApiError ? err.message : 'Stripe confirmation failed';
          setFormErr(msg);
          setStep('payment');
          setPayTab('stripe');
        })
        .finally(() => { setPlacing(false); window.history.replaceState({}, '', '/checkout'); });
    } else if (canceled) {
      setFormErr('Payment was canceled. You can try again below.');
      setStep('payment');
      setPayTab('stripe');
      window.history.replaceState({}, '', '/checkout');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!user) {
    return (
      <div style={{ padding: '60px 28px', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px' }}>Sign in to checkout</p>
        <Link href="/login" style={{ display: 'inline-block', marginTop: '12px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '11px 22px', borderRadius: '6px', textDecoration: 'none' }}>Sign in</Link>
      </div>
    );
  }

  if (items.length === 0 && step !== 'done') {
    return (
      <div style={{ padding: '60px 28px', textAlign: 'center' }}>
        <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '22px' }}>Nothing to check out</p>
        <Link href="/catalog" style={{ display: 'inline-block', marginTop: '12px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '10px 20px', borderRadius: '6px', textDecoration: 'none' }}>Browse the shop</Link>
      </div>
    );
  }

  function validateShipping(): boolean {
    const errs: Partial<ShipInfo> = {};
    if (!shipInfo.name.trim())  errs.name  = 'Required';
    if (!shipInfo.email.trim()) errs.email = 'Required';
    if (!shipInfo.addr.trim())  errs.addr  = 'Required';
    if (!shipInfo.city.trim())  errs.city  = 'Required';
    if (!shipInfo.zip.trim())   errs.zip   = 'Required';
    setShipErrs(errs);
    return Object.keys(errs).length === 0;
  }

  function validatePayment(): boolean {
    const errs: Partial<PayInfo> = {};
    if (!/^\d{16}$/.test(payInfo.card.replace(/\s/g, ''))) errs.card = 'Enter a valid 16-digit card number';
    if (!/^\d{2}\/\d{2}$/.test(payInfo.exp))               errs.exp  = 'Format MM/YY';
    if (!/^\d{3,4}$/.test(payInfo.cvc))                    errs.cvc  = '3–4 digits';
    if (!payInfo.name.trim())                               errs.name = 'Required';
    setPayErrs(errs);
    return Object.keys(errs).length === 0;
  }

  async function placeOrder() {
    if (!validatePayment()) return;
    if (!token) return;
    setPlacing(true);
    setFormErr('');
    try {
      const o = await api.withToken(token).post<Order>('/orders/checkout', {});
      setOrder(o);
      clear();
      setStep('done');
    } catch (err: unknown) {
      setFormErr(err instanceof ApiError ? err.message : 'Checkout failed — try again.');
    } finally {
      setPlacing(false);
    }
  }

  async function startStripeCheckout() {
    if (!token) return;
    setStripeRedirecting(true);
    setFormErr('');
    try {
      const { url } = await api.withToken(token).post<{ url: string }>('/orders/checkout/stripe-session', {});
      if (url) { window.location.href = url; }
    } catch (err: unknown) {
      setFormErr(err instanceof ApiError ? err.message : 'Could not start Stripe checkout — try again.');
      setStripeRedirecting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', fontSize: '14px', background: '#FFFFFF',
    border: '1px solid rgba(58,58,44,0.16)', borderRadius: '6px',
    padding: '10px 12px', outline: 'none', color: '#3A3A2C', fontFamily: 'inherit',
  };

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done' && order) {
    return (
      <div style={{ padding: '28px' }}>
        <StepIndicator step={step} />
        <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '40px 32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '999px', background: '#E3F0E8', color: '#2E7D52', fontSize: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>✓</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', letterSpacing: '0.14em', color: '#8A8676', textTransform: 'uppercase' }}>Order confirmed</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '30px', margin: '8px 0 6px', color: '#3A3A2C' }}>Thank you, it's on the way</h1>
          <div style={{ fontSize: '14px', color: '#8CA0C8', marginBottom: '24px' }}>
            Order <strong style={{ fontFamily: "'Space Mono', monospace", color: '#3A3A2C' }}>#{order.id}</strong> · a confirmation is on its way to your email.
          </div>
          <div style={{ textAlign: 'left', background: 'rgba(58,58,44,0.03)', border: '1px solid rgba(58,58,44,0.06)', borderRadius: '10px', padding: '18px', marginBottom: '22px' }}>
            {order.items.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '7px 0', color: '#3A3A2C' }}>
                <span>{i.product.name} ×{i.quantity}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>{formatCents(i.unitPriceCents * i.quantity)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '8px', paddingTop: '12px', borderTop: '1px solid rgba(58,58,44,0.12)', color: '#3A3A2C' }}>
              <span>Total paid</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '17px' }}>{formatCents(order.totalCents)}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/orders" style={{ fontSize: '14px', fontWeight: 600, color: '#3A3A2C', background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.16)', padding: '11px 20px', borderRadius: '6px', textDecoration: 'none' }}>View my orders</Link>
            <Link href="/catalog" style={{ fontSize: '14px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', padding: '11px 20px', borderRadius: '6px', textDecoration: 'none' }}>Continue shopping</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px' }}>
      <StepIndicator step={step} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        {/* Form panel */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '24px' }}>

          {/* ── Info step ── */}
          {step === 'info' && (
            <>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '21px', margin: '0 0 18px', color: '#3A3A2C' }}>Shipping details</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Field label="Full name" err={shipErrs.name}>
                  <input value={shipInfo.name} onChange={e => setShipInfo(s => ({ ...s, name: e.target.value }))} placeholder="Alex Stone" style={{ ...inputStyle, borderColor: shipErrs.name ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                </Field>
                <Field label="Email" err={shipErrs.email}>
                  <input type="email" value={shipInfo.email} onChange={e => setShipInfo(s => ({ ...s, email: e.target.value }))} placeholder="you@example.com" style={{ ...inputStyle, borderColor: shipErrs.email ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                </Field>
                <Field label="Address" err={shipErrs.addr}>
                  <input value={shipInfo.addr} onChange={e => setShipInfo(s => ({ ...s, addr: e.target.value }))} placeholder="14 Kiln Lane" style={{ ...inputStyle, borderColor: shipErrs.addr ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '14px' }}>
                  <Field label="City" err={shipErrs.city}>
                    <input value={shipInfo.city} onChange={e => setShipInfo(s => ({ ...s, city: e.target.value }))} placeholder="Portland" style={{ ...inputStyle, borderColor: shipErrs.city ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                  </Field>
                  <Field label="ZIP" err={shipErrs.zip}>
                    <input value={shipInfo.zip} onChange={e => setShipInfo(s => ({ ...s, zip: e.target.value }))} placeholder="97201" style={{ ...inputStyle, borderColor: shipErrs.zip ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                  </Field>
                </div>
              </div>
              <button onClick={() => validateShipping() && setStep('payment')} style={{ width: '100%', fontSize: '15px', fontWeight: 600, color: '#FAF6EC', background: '#43432B', border: 'none', padding: '13px', borderRadius: '6px', cursor: 'pointer', marginTop: '20px' }}>
                Continue to payment
              </button>
            </>
          )}

          {/* ── Payment step ── */}
          {step === 'payment' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 500, fontSize: '21px', margin: 0, color: '#3A3A2C' }}>Payment</h2>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', background: '#F7ECD6', color: '#8A5A0F', padding: '4px 9px', borderRadius: '3px' }}>TEST MODE</span>
              </div>

              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: '0', marginBottom: '20px', border: '1px solid rgba(58,58,44,0.14)', borderRadius: '7px', overflow: 'hidden' }}>
                <TabBtn label="Card" active={payTab === 'card'} onClick={() => { setPayTab('card'); setFormErr(''); }} />
                <TabBtn label="Pay with Stripe" active={payTab === 'stripe'} onClick={() => { setPayTab('stripe'); setFormErr(''); }} stripe />
              </div>

              {formErr && (
                <div style={{ fontSize: '13px', color: '#8A241A', background: '#F6E0DD', border: '1px solid rgba(168,46,34,0.20)', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px' }}>{formErr}</div>
              )}

              {/* ── Card tab ── */}
              {payTab === 'card' && (
                <>
                  <div style={{ background: 'rgba(67,67,43,0.07)', border: '1px solid rgba(67,67,43,0.28)', borderRadius: '8px', padding: '12px 14px', fontSize: '12.5px', color: '#8A5A0F', marginBottom: '18px', lineHeight: 1.5 }}>
                    No real charge. Test card: <strong style={{ fontFamily: "'Space Mono', monospace" }}>4242 4242 4242 4242</strong>, any future date, any CVC.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <Field label="Card number" err={payErrs.card}>
                      <input value={payInfo.card} onChange={e => setPayInfo(p => ({ ...p, card: e.target.value }))} placeholder="4242 4242 4242 4242" style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", borderColor: payErrs.card ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                    </Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <Field label="Expiry" err={payErrs.exp}>
                        <input value={payInfo.exp} onChange={e => setPayInfo(p => ({ ...p, exp: e.target.value }))} placeholder="MM/YY" style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", borderColor: payErrs.exp ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                      </Field>
                      <Field label="CVC" err={payErrs.cvc}>
                        <input value={payInfo.cvc} onChange={e => setPayInfo(p => ({ ...p, cvc: e.target.value }))} placeholder="123" style={{ ...inputStyle, fontFamily: "'Space Mono', monospace", borderColor: payErrs.cvc ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                      </Field>
                    </div>
                    <Field label="Name on card" err={payErrs.name}>
                      <input value={payInfo.name} onChange={e => setPayInfo(p => ({ ...p, name: e.target.value }))} placeholder="Alex Stone" style={{ ...inputStyle, borderColor: payErrs.name ? '#A82E22' : 'rgba(58,58,44,0.16)' }} />
                    </Field>
                  </div>
                  <button onClick={placeOrder} disabled={placing} style={{ width: '100%', fontSize: '15px', fontWeight: 600, color: '#FAF6EC', background: placing ? '#8A8676' : '#43432B', border: 'none', padding: '13px', borderRadius: '6px', cursor: placing ? 'not-allowed' : 'pointer', marginTop: '20px' }}>
                    {placing ? 'Processing…' : `Pay ${formatCents(total)}`}
                  </button>
                </>
              )}

              {/* ── Stripe tab ── */}
              {payTab === 'stripe' && (
                <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
                  {/* Redirect explainer */}
                  <div style={{ fontSize: '13px', color: '#6B6857', lineHeight: 1.6, marginBottom: '24px', maxWidth: '340px', margin: '0 auto 24px' }}>
                    You'll be redirected to Stripe's secure checkout page. Your payment details are handled by Stripe — we never see your card number.
                  </div>

                  {/* Stripe CTA button */}
                  <button
                    onClick={startStripeCheckout}
                    disabled={stripeRedirecting}
                    style={{ width: '100%', fontSize: '15px', fontWeight: 700, color: '#FFFFFF', background: stripeRedirecting ? '#7c74e0' : '#635BFF', border: 'none', padding: '14px', borderRadius: '6px', cursor: stripeRedirecting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    {stripeRedirecting ? (
                      <>Redirecting to Stripe…</>
                    ) : (
                      <>Pay with Stripe — {formatCents(total)} →</>
                    )}
                  </button>

                  {/* Payment methods row */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '16px', flexWrap: 'wrap' }}>
                    {['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay'].map(m => (
                      <span key={m} style={{ fontSize: '11px', fontFamily: "'Space Mono', monospace", color: '#8A8676', background: '#F5F5F0', border: '1px solid rgba(58,58,44,0.12)', padding: '3px 8px', borderRadius: '4px' }}>{m}</span>
                    ))}
                  </div>

                  <div style={{ marginTop: '16px', fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#A39E8C' }}>
                    POWERED BY STRIPE · SSL SECURED
                  </div>
                </div>
              )}

              <div onClick={() => setStep('info')} style={{ textAlign: 'center', fontSize: '13px', color: '#8A8676', marginTop: '16px', cursor: 'pointer' }}>← Back to information</div>
            </>
          )}
        </div>

        {/* Summary */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '12px', padding: '22px', position: 'sticky', top: '90px' }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '18px', fontWeight: 500, marginBottom: '14px', color: '#3A3A2C' }}>
            {items.length} item{items.length !== 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '220px', overflowY: 'auto' }}>
            {items.map(i => (
              <div key={i.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '6px', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#e8e4d8,#d5d0bc)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.product.imageUrl} alt={i.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, fontSize: '13px' }}>
                  <div style={{ fontWeight: 600, color: '#3A3A2C' }}>{i.product.name}</div>
                  <div style={{ color: '#8A8676', fontFamily: "'Space Mono', monospace", fontSize: '11px' }}>×{i.quantity}</div>
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#3A3A2C' }}>{formatCents(i.product.priceCents * i.quantity)}</div>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: '14px', borderTop: '1px solid rgba(58,58,44,0.12)' }}>
            <SumRow label="Subtotal" value={formatCents(subtotal)} />
            <SumRow label="Shipping" value={shipping === 0 ? 'Free' : formatCents(shipping)} valueStyle={{ color: shipping === 0 ? '#2E7D52' : '#3A3A2C' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontWeight: 700, marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(58,58,44,0.12)', color: '#3A3A2C' }}>
              <span>Total</span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '18px' }}>{formatCents(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', fontFamily: "'Space Mono', monospace", fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      <StepChip label="1 · Information" active={step === 'info'} done={step !== 'info'} />
      <span style={{ color: '#A39E8C' }}>→</span>
      <StepChip label="2 · Payment" active={step === 'payment'} done={step === 'done'} />
      <span style={{ color: '#A39E8C' }}>→</span>
      <StepChip label="3 · Confirmation" active={step === 'done'} done={false} />
    </div>
  );
}

function StepChip({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span style={{
      padding: '5px 11px', borderRadius: '999px',
      background: active ? '#43432B' : done ? '#E3F0E8' : 'transparent',
      color: active ? '#FAF6EC' : done ? '#2E7D52' : '#A39E8C',
      border: active || done ? 'none' : '1px solid rgba(58,58,44,0.16)',
    }}>{label}</span>
  );
}

function TabBtn({ label, active, onClick, stripe }: { label: string; active: boolean; onClick: () => void; stripe?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 14px', fontSize: '13px', fontWeight: 600, border: 'none',
        cursor: 'pointer', borderRight: stripe ? 'none' : '1px solid rgba(58,58,44,0.14)',
        background: active ? (stripe ? '#635BFF' : '#43432B') : '#FAFAF8',
        color: active ? '#FFFFFF' : stripe ? '#635BFF' : '#3A3A2C',
        transition: 'background 0.15s',
      }}
    >{label}</button>
  );
}

function Field({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#3A3A2C' }}>{label}</label>
      {children}
      {err && <div style={{ fontSize: '12px', color: '#A82E22', marginTop: '5px' }}>{err}</div>}
    </div>
  );
}

function SumRow({ label, value, valueStyle }: { label: string; value: string; valueStyle?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#6B6857', marginBottom: '8px' }}>
      <span>{label}</span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 600, ...valueStyle }}>{value}</span>
    </div>
  );
}
