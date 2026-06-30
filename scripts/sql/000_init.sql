// 启用 pgvector 扩展 + 修正 enum/索引
// 在 Prisma migrate 后由 scripts/sql/000_init.sql 手动执行

-- pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- updated_at 自动维护触发器
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 给所有有 updated_at 字段的表挂触发器
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = 'public'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON %s;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

-- Embeddings 表（pgvector 列，Prisma 不支持，手建）
CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  model VARCHAR(64) NOT NULL DEFAULT 'embedding-3',
  embedding vector(1536) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS embeddings_chunk_id_idx ON embeddings(chunk_id);
CREATE INDEX IF NOT EXISTS embeddings_vector_idx ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- uuid 默认值兜底（Prisma client 生成 uuid，但 SQL 直插时需要）
-- 已由各表 default gen_random_uuid() 处理
