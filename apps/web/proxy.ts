import { NextResponse, type NextRequest } from 'next/server';

/**
 * Serves the API at /api/* on this site (API_PROXY_TARGET, e.g. the Railway URL), so the session cookie is
 * first-party and the API needs no domain of its own. Through the proxy the API sees Vercel's addresses, so
 * the visitor's IP goes along for its rate limits, signed with PROXY_SECRET (shared with the API). Headers a
 * client sends under the same names are dropped first. WebSockets can't be proxied; /ws is reached directly
 * through NEXT_PUBLIC_WS_URL (it needs no cookie).
 */
export function proxy(request: NextRequest) {
  const target = process.env.API_PROXY_TARGET?.replace(/\/$/, '');
  if (!target) return NextResponse.next();

  const headers = new Headers(request.headers);
  headers.delete('x-hood-client-ip');
  headers.delete('x-hood-proxy-secret');
  const secret = process.env.PROXY_SECRET;
  // Vercel sets both from the connection and overwrites what the client sent.
  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (secret && ip) {
    headers.set('x-hood-client-ip', ip);
    headers.set('x-hood-proxy-secret', secret);
  }

  const { pathname, search } = request.nextUrl;
  return NextResponse.rewrite(new URL(`${pathname.replace(/^\/api/, '')}${search}`, target), { request: { headers } });
}

export const config = {
  matcher: '/api/:path*',
};
