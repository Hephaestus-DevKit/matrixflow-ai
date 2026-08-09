/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',
  reactStrictMode: true,
  // ESLint is a standalone zero-warning CI gate; avoid running it again inside next build.
  eslint: { ignoreDuringBuilds: true },
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
  typedRoutes: true,
  transpilePackages: ['@matrixflow/shared'],
};

module.exports = nextConfig;
