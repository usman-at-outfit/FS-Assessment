const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
  }
}

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

  return res.json() as Promise<T>;
}

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

  // Authenticated helper — pass token explicitly so we avoid
  // synchronous localStorage reads during SSR.
  withToken: (token: string) => ({
    get:  <T>(path: string) => request<T>(path, { method: 'GET' }, token),
    post: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token),
    patch: <T>(path: string, body: unknown) =>
      request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }, token),
    delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }, token),
  }),
};
