const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id:   number;
  name: string;
  slug: string;
}

export interface ProductImage {
  id:        number;
  productId: number;
  url:       string;
  sortOrder: number;
  createdAt: string;
}

export interface Product {
  id:          number;
  name:        string;
  description: string;
  priceCents:  number;
  imageUrl:    string;   // primary thumbnail (backward-compat)
  stock:       number;
  categoryId:  number;
  createdAt:   string;
  category:    Category;
  images?:     ProductImage[];  // gallery images (populated by findOne + admin endpoints)
}

export interface ProductListResponse {
  items:    Product[];
  total:    number;
  page:     number;
  pageSize: number;
}

export interface CartItem {
  id:        number;
  cartId:    number;
  productId: number;
  quantity:  number;
  product:   Product;
}

export interface CartResponse {
  id:     number;
  userId: number;
  items:  CartItem[];
}

export interface OrderItem {
  id:            number;
  orderId:       number;
  productId:     number;
  unitPriceCents: number;
  quantity:      number;
  product:       { id: number; name: string; imageUrl: string };
}

export interface Order {
  id:         number;
  userId:     number;
  status:     'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  totalCents: number;
  createdAt:  string;
  items:      OrderItem[];
}

// ─── Request helper ───────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg  = Array.isArray(body?.message)
      ? body.message.join(', ')
      : body?.message ?? res.statusText;
    throw new ApiError(res.status, msg, body);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ─── API surface ──────────────────────────────────────────────────────────────

export const api = {
  auth: {
    signup: (email: string, password: string) =>
      request<{ accessToken: string }>('/auth/signup', {
        method: 'POST',
        body:   JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ accessToken: string }>('/auth/login', {
        method: 'POST',
        body:   JSON.stringify({ email, password }),
      }),
  },

  products: {
    list: (params: Record<string, string | number | undefined> = {}) => {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== '') qs.set(k, String(v));
      }
      const query = qs.toString() ? `?${qs.toString()}` : '';
      return request<ProductListResponse>(`/products${query}`);
    },
    get: (id: number) => request<Product>(`/products/${id}`),
  },

  categories: {
    list: () => request<Category[]>('/categories'),
  },

  suggestions: {
    get: (opts?: { token?: string; exclude?: number }) => {
      const qs = opts?.exclude ? `?exclude=${opts.exclude}` : '';
      return request<Product[]>(`/suggestions${qs}`, {}, opts?.token);
    },
  },

  withToken: (token: string) => ({
    get:    <T>(path: string)                => request<T>(path, { method: 'GET'    }, token),
    post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }, token),
    patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }, token),
    delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }, token),

    /** Upload files via multipart/form-data (no Content-Type header — browser sets boundary). */
    upload: async <T>(path: string, formData: FormData): Promise<T> => {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg  = Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? res.statusText;
        throw new ApiError(res.status, msg, body);
      }
      return res.json() as Promise<T>;
    },
  }),
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
