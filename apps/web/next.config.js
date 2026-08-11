/** @type {import('next').NextConfig} */
const isDevelopment = process.env.NODE_ENV === 'development';

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
              "connect-src 'self' https://sgp.cloud.appwrite.io wss://sgp.cloud.appwrite.io",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              ...(isDevelopment ? [] : ['upgrade-insecure-requests']),
            ].join('; '),
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
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
