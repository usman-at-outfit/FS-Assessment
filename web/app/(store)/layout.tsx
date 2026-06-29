import { Suspense } from 'react';
import { StoreHeader } from '@/components/store-header';
import { StoreFooter } from '@/components/store-footer';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF6EC', display: 'flex', flexDirection: 'column' }}>
      <Suspense fallback={null}>
        <StoreHeader />
      </Suspense>
      <main style={{ flex: 1 }}>{children}</main>
      <StoreFooter />
    </div>
  );
}
