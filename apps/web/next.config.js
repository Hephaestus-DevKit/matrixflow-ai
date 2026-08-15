/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === 'development';
const appwriteEndpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
let appwriteOrigin = 'https://sgp.cloud.appwrite.io';
try {
  appwriteOrigin = new URL(appwriteEndpoint).origin;
} catch {
  // Keep the production default when a malformed build-time endpoint is supplied.
}
const appwriteWebSocketOrigin = appwriteOrigin.replace(/^http/i, 'ws');
const appwriteHostname = new URL(appwriteOrigin).hostname;

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // ESLint is a standalone zero-warning CI gate; avoid running it again inside next build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'sgp.cloud.appwrite.io' },
      { protocol: 'https', hostname: 'cloud.appwrite.io' },
      { protocol: 'https', hostname: appwriteHostname },
    ],
  },
  typedRoutes: true,
  transpilePackages: ['@matrixflow/shared'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://sgp.cloud.appwrite.io https://cloud.appwrite.io",
              "font-src 'self' data:",
              `connect-src 'self' ${appwriteOrigin} ${appwriteWebSocketOrigin} https://cloud.appwrite.io wss://cloud.appwrite.io`,
              "object-src 'none'",
              "script-src-attr 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
            ].join('; '),
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          ...(isDevelopment
            ? []
            : [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
              ]),
        ],
      },
    ];
  },
};

module.exports = nextConfig;
