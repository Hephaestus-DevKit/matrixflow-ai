-- Normalize databases created by the former bootstrap SQL (which used an
-- `embedding` column) with databases created by Prisma (which use `vector`).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'embeddings' AND column_name = 'embedding'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'embeddings' AND column_name = 'vector'
  ) THEN
    ALTER TABLE embeddings RENAME COLUMN embedding TO vector;
  END IF;
END $$;

ALTER TABLE embeddings
  ALTER COLUMN vector TYPE vector(1536) USING vector::vector(1536);

CREATE INDEX IF NOT EXISTS embeddings_vector_idx
  ON embeddings USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
