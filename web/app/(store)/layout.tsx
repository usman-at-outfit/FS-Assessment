import { StoreHeader } from '@/components/store-header';

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#FAF6EC' }}>
      <StoreHeader />
      <main>{children}</main>
    </div>
  );
}
