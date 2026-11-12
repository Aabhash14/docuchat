import { Pool } from "pg";
import { EMBEDDING_DIMENSIONS } from "./embeddings";

const globalForDb = globalThis as unknown as { pool?: Pool; schemaReady?: Promise<void> };

export function getPool(): Pool {
  if (!globalForDb.pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
    globalForDb.pool = new Pool({ connectionString, max: 5 });
  }
  return globalForDb.pool;
}

const SCHEMA = `
  CREATE EXTENSION IF NOT EXISTS vector;

  CREATE TABLE IF NOT EXISTS documents (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL,
    size_bytes  integer NOT NULL,
    pages       integer,
    chunk_count integer NOT NULL DEFAULT 0,
    created_at  timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id          bigserial PRIMARY KEY,
    document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    ordinal     integer NOT NULL,
    page        integer,
    content     text NOT NULL,
    embedding   vector(${EMBEDDING_DIMENSIONS}) NOT NULL
  );

  CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON chunks (document_id);
  CREATE INDEX IF NOT EXISTS chunks_embedding_idx ON chunks USING hnsw (embedding vector_cosine_ops);
`;

/** Creates the schema on first use. Idempotent, and runs once per server process. */
export async function db(): Promise<Pool> {
  const pool = getPool();
  globalForDb.schemaReady ??= pool.query(SCHEMA).then(() => undefined);
  try {
    await globalForDb.schemaReady;
  } catch (error) {
    globalForDb.schemaReady = undefined; // let the next request retry, e.g. once the database is up
    throw error;
  }
  return pool;
}
