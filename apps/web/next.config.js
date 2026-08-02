/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export',
  reactStrictMode: true,
  images: { 
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }] 
  },
  typedRoutes: true,
  transpilePackages: ['@matrixflow/shared', '@matrixflow/ui'],
};

module.exports = nextConfig;
