import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MatrixFlow AI — 团队 AI 运营工作台';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: 80,
        color: 'white',
        background: 'radial-gradient(circle at 20% 10%, #6d28d9 0, #11111b 50%, #07070c 100%)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 20, fontSize: 30, fontWeight: 800 }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 64,
            height: 64,
            borderRadius: 18,
            background: '#7c3aed',
          }}
        >
          M
        </div>
        MatrixFlow AI
      </div>
      <div
        style={{ marginTop: 52, maxWidth: 900, fontSize: 68, lineHeight: 1.12, fontWeight: 900 }}
      >
        让内容、知识与工作流在一个团队空间中协作
      </div>
      <div style={{ marginTop: 30, fontSize: 28, color: '#c4b5fd' }}>
        Appwrite 原生 · 权限隔离 · 可追踪 AI 运行
      </div>
    </div>,
    size,
  );
}
