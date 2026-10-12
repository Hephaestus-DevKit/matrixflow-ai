import { SITE_ORIGIN } from '@/lib/site';
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE_ORIGIN;
  return ['', '/pricing', '/privacy', '/terms'].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path === '/pricing' ? 0.8 : 0.4,
  }));
}
