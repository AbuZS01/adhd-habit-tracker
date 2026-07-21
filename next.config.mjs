/** @type {import('next').NextConfig} */

// Content-Security-Policy: restrict everything to same-origin by default.
// 'unsafe-inline' is NOT used for scripts. Next.js injects its runtime via
// hashed/nonced inline scripts only when needed; we avoid inline event
// handlers and dangerouslySetInnerHTML everywhere (SR-2), so a strict CSP
// without 'unsafe-inline' script-src is achievable.
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
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
