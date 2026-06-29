import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication (any role)
const PROTECTED = ['/account', '/orders', '/cart', '/checkout'];
// Routes that require ADMIN role
const ADMIN_ONLY = ['/admin'];
// Routes only for unauthenticated users (redirect away if logged in)
const AUTH_ROUTES = ['/login', '/signup'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('ecomm_token')?.value;

  const isProtected  = PROTECTED.some((p) => pathname.startsWith(p));
  const isAdminOnly  = ADMIN_ONLY.some((p) => pathname.startsWith(p));
  const isAuthRoute  = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if ((isProtected || isAdminOnly) && !token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminOnly && token) {
    // UX-only redirect: signature is NOT verified here — the real ADMIN gate is
    // RolesGuard on the API. Never use this decode for any security decision.
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      );
      if (payload.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/', req.url));
      }
    } catch {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/account/:path*',
    '/orders/:path*',
    '/cart/:path*',
    '/checkout/:path*',
    '/admin/:path*',
    '/login',
    '/signup',
  ],
};
