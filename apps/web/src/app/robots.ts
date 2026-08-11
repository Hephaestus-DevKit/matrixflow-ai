import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/pricing', '/privacy', '/terms'], disallow: ['/dashboard/'] },
    ],
    sitemap: 'https://matrixflow-ai.vercel.app/sitemap.xml',
  };
}
