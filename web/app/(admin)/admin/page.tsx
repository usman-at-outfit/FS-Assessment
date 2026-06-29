'use client';

/**
 * Admin Dashboard — placeholder.
 * Real stats + Recharts bar chart implemented in M10.
 */
export default function AdminDashboardPage() {
  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.12em', color: '#8A8676', marginBottom: '6px' }}>OVERVIEW</div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '24px', fontWeight: 500, color: '#3A3A2C' }}>Dashboard</div>
      </div>

      {/* Placeholder stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
        {[
          { label: 'Total revenue',   placeholder: '—' },
          { label: 'Total orders',    placeholder: '—' },
          { label: 'Avg. order value',placeholder: '—' },
          { label: 'Needs attention', placeholder: '—' },
        ].map(card => (
          <div key={card.label} style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', padding: '20px 22px' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.10em', color: '#8A8676', marginBottom: '10px', textTransform: 'uppercase' }}>{card.label}</div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '28px', fontWeight: 500, color: '#3A3A2C' }}>{card.placeholder}</div>
          </div>
        ))}
      </div>

      {/* Coming soon panel */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(58,58,44,0.10)', borderRadius: '10px', padding: '40px 22px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: '12px', letterSpacing: '0.12em', color: '#8A8676', marginBottom: '10px' }}>ANALYTICS CHART</div>
        <div style={{ fontSize: '14px', color: '#6B6857', lineHeight: 1.6, maxWidth: '360px', margin: '0 auto' }}>
          Orders-by-status bar chart and top-selling products will be built in M10 once orders and products data is live.
        </div>
      </div>
    </div>
  );
}
