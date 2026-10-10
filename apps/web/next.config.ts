import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ['@hood/shared'],
  // Dev only: lets the dev server be opened as 127.0.0.1 as well as localhost.
  allowedDevOrigins: ['127.0.0.1'],
  // Keep the dev badge off the start button.
  devIndicators: { position: 'top-right' },
  // /api/* is proxied to the API by proxy.ts (API_PROXY_TARGET).
};

export default nextConfig;
