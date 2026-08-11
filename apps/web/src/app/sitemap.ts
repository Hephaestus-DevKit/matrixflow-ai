import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://matrixflow-ai.vercel.app';
  return ['', '/pricing', '/privacy', '/terms'].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date('2026-08-11'),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/pricing' ? 0.8 : 0.4,
  }));
}
