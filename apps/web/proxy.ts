import { NextResponse, type NextRequest } from 'next/server';

/**
 * Runs before the /api rewrite (next.config.ts). Through the rewrite the API sees Vercel's addresses, so
 * this forwards the visitor's IP for its rate limits, signed with PROXY_SECRET (shared with the API).
 * Headers a client sends under the same names are dropped first.
 */
export function proxy(request: NextRequest) {
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
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: '/api/:path*',
};
