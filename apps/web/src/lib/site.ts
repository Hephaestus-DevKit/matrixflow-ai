/** Canonical production origin shared by metadata, robots, and sitemap. */
export const SITE_ORIGIN = new URL(
  process.env.MATRIXFLOW_PUBLIC_URL || 'https://matrixflow-ai-sycamore-tree.vercel.app',
).origin;
