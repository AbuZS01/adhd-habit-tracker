/** @type {import('next').NextConfig} */

// Content-Security-Policy is intentionally NOT set here: it must carry a
// fresh per-request nonce so Next.js's own inline hydration scripts can
// run under a strict `script-src`, and next.config's headers() only
// supports static values. See src/middleware.ts for the real CSP.
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Apply security headers to every route, including API routes (SR-13).
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
