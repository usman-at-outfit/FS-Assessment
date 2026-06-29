import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF6EC', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <Link href="/" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '26px', fontWeight: 600, color: '#3A3A2C', textDecoration: 'none', marginBottom: '32px', letterSpacing: '-0.01em' }}>
        Sundry
      </Link>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {children}
      </div>
    </div>
  );
}
