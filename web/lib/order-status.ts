import type { CSSProperties } from 'react';
import type { Order } from './api-client';

/** Canonical status colours from the Sundry design (admin + storefront share these). */
export const ORDER_STATUS: Record<
  Order['status'],
  { bg: string; color: string; dot: string; label: string }
> = {
  PENDING:    { bg: 'rgba(58,58,44,0.05)', color: '#6B6857', dot: '#8A8676', label: 'Pending'    },
  PROCESSING: { bg: '#F7ECD6',             color: '#8A5A0F', dot: '#B57A1A', label: 'Processing' },
  SHIPPED:    { bg: '#DCEAF3',             color: '#1F5273', dot: '#2C6E9B', label: 'Shipped'    },
  DELIVERED:  { bg: '#E3F0E8',             color: '#1F5C3B', dot: '#2E7D52', label: 'Delivered'  },
  CANCELLED:  { bg: '#F6E0DD',             color: '#8A241A', dot: '#A82E22', label: 'Cancelled'  },
};

/** Inline style for an order status pill badge (use via `style={statusPillStyle(s)}`). */
export function statusPillStyle(status: Order['status']): CSSProperties {
  const s = ORDER_STATUS[status];
  return {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    fontSize: '12px', fontWeight: 600, padding: '4px 10px',
    borderRadius: '999px', background: s.bg, color: s.color,
  };
}
