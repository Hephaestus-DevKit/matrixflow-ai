import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MatrixFlow AI',
    short_name: 'MatrixFlow',
    description: 'Appwrite 原生的团队 AI 内容、知识库与工作流平台。',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0b0b12',
    theme_color: '#7c3aed',
    lang: 'zh-CN',
  };
}
