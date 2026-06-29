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

export function pickThumb(product: Pick<Product, 'imageUrl' | 'images'>): string {
  if (product.images && product.images.length > 0) {
    const uploaded = product.images.find(i => i.url.includes('/uploads/'));
    return uploaded ? uploaded.url : product.images[0].url;
  }
  return product.imageUrl;
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

export interface AdminOrder extends Order {
  user: { id: number; email: string };
}

export interface AdminOrderListResponse {
  items:    AdminOrder[];
  total:    number;
  page:     number;
  pageSize: number;
}

// ─── Token storage keys ───────────────────────────────────────────────────────

export const ACCESS_TOKEN_KEY  = 'ecomm_token';
export const REFRESH_TOKEN_KEY = 'ecomm_refresh_token';

// ─── Refresh helper ───────────────────────────────────────────────────────────

let refreshInFlight: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  // Deduplicate: if a refresh is already in-flight, wait for it instead of firing two.
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return null;
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const { accessToken, refreshToken: newRefresh } = await res.json() as {
        accessToken: string; refreshToken: string;
      };
      localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      if (newRefresh) localStorage.setItem(REFRESH_TOKEN_KEY, newRefresh);
      // Sync cookie so Next.js middleware stays in sync
      document.cookie = `${ACCESS_TOKEN_KEY}=${accessToken}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
      // Notify auth context to update its React state
      window.dispatchEvent(new CustomEvent('auth:token-refreshed', { detail: { accessToken } }));
      return accessToken;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function signalUnauthorized() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
}

// ─── Request helper ───────────────────────────────────────────────────────────

const SKIP_REFRESH_PATHS = new Set(['/auth/refresh', '/auth/logout']);

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

  if (res.status === 401 && !SKIP_REFRESH_PATHS.has(path)) {
    // Try to silently refresh and retry the original request once.
    const newToken = await tryRefresh();
    if (newToken) {
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...headers, Authorization: `Bearer ${newToken}` },
      });
      if (retryRes.ok) {
        if (retryRes.status === 204) return undefined as unknown as T;
        return retryRes.json() as Promise<T>;
      }
    }
    // Refresh failed or retry still 401 — log the user out.
    signalUnauthorized();
    const errBody = await res.json().catch(() => ({}));
    throw new ApiError(res.status, 'Session expired — please log in again', errBody);
  }

  if (!res.ok) {
    if (res.status === 401) signalUnauthorized();
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
      request<{ accessToken: string; refreshToken: string }>('/auth/signup', {
        method: 'POST',
        body:   JSON.stringify({ email, password }),
      }),
    login: (email: string, password: string) =>
      request<{ accessToken: string; refreshToken: string }>('/auth/login', {
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

  get: <T>(path: string) => request<T>(path, { method: 'GET' }),

  withToken: (token: string) => ({
    get:    <T>(path: string)                => request<T>(path, { method: 'GET'    }, token),
    post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }, token),
    put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }, token),
    patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }, token),
    delete: <T>(path: string)                => request<T>(path, { method: 'DELETE' }, token),

    /** Upload files via multipart/form-data (no Content-Type header — browser sets boundary). */
    upload: async <T>(path: string, formData: FormData): Promise<T> => {
      const doUpload = (t: string) =>
        fetch(`${API_BASE}${path}`, {
          method:  'POST',
          headers: { Authorization: `Bearer ${t}` },
          body:    formData,
        });

      let res = await doUpload(token);

      if (res.status === 401) {
        const newToken = await tryRefresh();
        if (newToken) {
          res = await doUpload(newToken);
        } else {
          signalUnauthorized();
          throw new ApiError(401, 'Session expired — please log in again');
        }
      }

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
