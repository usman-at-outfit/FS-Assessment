'use client';

import Link from 'next/link';

export function StoreFooter() {
  return (
    <footer style={{ background: '#3A3A2C', color: '#FAF6EC', marginTop: '80px' }}>
      {/* Main grid */}
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '56px 28px 40px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '40px' }}>

        {/* Brand column */}
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '26px', fontWeight: 600, color: '#FAF6EC', letterSpacing: '-0.01em', marginBottom: '14px' }}>
            Sundry
          </div>
          <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#C8C4A8', maxWidth: '260px', margin: '0 0 20px' }}>
            Plastic-free home essentials designed to replace single-use plastic — beautifully made, built to last.
          </p>
          {/* Social links */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              { label: 'IG', title: 'Instagram' },
              { label: 'TW', title: 'Twitter / X' },
              { label: 'PT', title: 'Pinterest' },
            ].map(s => (
              <span
                key={s.label}
                title={s.title}
                style={{
                  width: '34px', height: '34px', borderRadius: '6px',
                  border: '1px solid rgba(250,246,236,0.15)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontFamily: "'Space Mono', monospace", fontWeight: 700,
                  color: '#C8C4A8', cursor: 'default',
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Shop */}
        <FooterCol title="Shop">
          <FooterLink href="/catalog">All products</FooterLink>
          <FooterLink href="/catalog?category=kitchen">Kitchen</FooterLink>
          <FooterLink href="/catalog?category=bath">Bath</FooterLink>
          <FooterLink href="/catalog?category=body">Body</FooterLink>
          <FooterLink href="/catalog?category=on-the-go">On the Go</FooterLink>
        </FooterCol>

        {/* Company */}
        <FooterCol title="Company">
          <FooterLink href="/">Our story</FooterLink>
          <FooterLink href="/">Sustainability</FooterLink>
          <FooterLink href="/">Materials guide</FooterLink>
          <FooterLink href="/">Press</FooterLink>
        </FooterCol>

        {/* Help */}
        <FooterCol title="Help">
          <FooterLink href="/">Shipping &amp; returns</FooterLink>
          <FooterLink href="/">Order tracking</FooterLink>
          <FooterLink href="/">FAQ</FooterLink>
          <FooterLink href="/">Contact us</FooterLink>
        </FooterCol>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: '1px solid rgba(250,246,236,0.10)', padding: '18px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', maxWidth: '1280px', margin: '0 auto' }}>
        <span style={{ fontSize: '12px', color: '#8A8676', fontFamily: "'Space Mono', monospace" }}>
          © {new Date().getFullYear()} Sundry. All rights reserved.
        </span>
        <div style={{ display: 'flex', gap: '20px' }}>
          {['Privacy policy', 'Terms of use', 'Cookie settings'].map(t => (
            <span key={t} style={{ fontSize: '12px', color: '#8A8676', cursor: 'default' }}>{t}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', color: '#8A8676', textTransform: 'uppercase', marginBottom: '14px' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {children}
      </div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: '13px', color: '#C8C4A8', textDecoration: 'none', lineHeight: 1 }}>
      {children}
    </Link>
  );
}
