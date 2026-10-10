import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@hood/shared'],
  // Dev only: lets the dev server be opened as 127.0.0.1 as well as localhost.
  allowedDevOrigins: ['127.0.0.1'],
  // Keep the dev badge off the start button.
  devIndicators: { position: 'top-right' },
  // With API_PROXY_TARGET set (production: the Railway URL), the browser calls the API as /api/* on this
  // site, so the session cookie is first-party and needs no shared domain. WebSockets can't be proxied
  // this way; /ws is reached directly through NEXT_PUBLIC_WS_URL (it needs no cookie).
  async rewrites() {
    const target = process.env.API_PROXY_TARGET?.replace(/\/$/, '');
    return target ? [{ source: '/api/:path*', destination: `${target}/:path*` }] : [];
  },
};

export default nextConfig;
