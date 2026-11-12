import { db } from "./db";
import { chunkPages } from "./chunk";
import { embed } from "./embeddings";
import { extractPages } from "./extract";

export interface DocumentSummary {
  id: string;
  name: string;
  sizeBytes: number;
  pages: number | null;
  chunkCount: number;
  createdAt: string;
}

export interface Source {
  /** 1-based number the model uses to cite this passage, e.g. [2]. */
  n: number;
  documentId: string;
  documentName: string;
  page: number | null;
  content: string;
  /** Cosine similarity, 0..1. */
  score: number;
}

export class EmptyDocumentError extends Error {}

/** pgvector accepts vectors as '[0.1,0.2,...]' text. */
const toVector = (values: number[]) => `[${values.join(",")}]`;

export async function ingestDocument(name: string, data: Uint8Array): Promise<DocumentSummary> {
  // Read the size first: the PDF parser takes ownership of the buffer, which leaves `data` empty.
  const sizeBytes = data.byteLength;
  const pages = await extractPages(name, data);
  const chunks = chunkPages(pages);
  if (chunks.length === 0) {
    throw new EmptyDocumentError(
      `No text found in "${name}". Scanned PDFs need OCR first; this demo reads PDFs with a text layer.`,
    );
  }
  const vectors = await embed(chunks.map((c) => c.content));
  const pageCount = pages[0]?.page === null ? null : pages.length;

  const pool = await db();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `INSERT INTO documents (name, size_bytes, pages, chunk_count) VALUES ($1, $2, $3, $4)
       RETURNING id, name, size_bytes, pages, chunk_count, created_at`,
      [name, sizeBytes, pageCount, chunks.length],
    );
    const doc = rows[0];

    // One multi-row INSERT per batch keeps large PDFs fast without hitting the parameter limit.
    const BATCH = 200;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const params: unknown[] = [];
      const values = batch.map((chunk, j) => {
        params.push(doc.id, chunk.ordinal, chunk.page, chunk.content, toVector(vectors[i + j]));
        const p = j * 5;
        return `($${p + 1}, $${p + 2}, $${p + 3}, $${p + 4}, $${p + 5}::vector)`;
      });
      await client.query(
        `INSERT INTO chunks (document_id, ordinal, page, content, embedding) VALUES ${values.join(", ")}`,
        params,
      );
    }
    await client.query("COMMIT");
    return toSummary(doc);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const pool = await db();
  const { rows } = await pool.query(
    "SELECT id, name, size_bytes, pages, chunk_count, created_at FROM documents ORDER BY created_at DESC",
  );
  return rows.map(toSummary);
}

/** Returns false when no document had that id. */
export async function deleteDocument(id: string): Promise<boolean> {
  const pool = await db();
  const { rowCount } = await pool.query("DELETE FROM documents WHERE id = $1", [id]);
  return (rowCount ?? 0) > 0;
}

/**
 * Nearest chunks to the query vector by cosine distance (served by the HNSW index).
 * Passages below `minScore` are dropped so an unrelated question gets "not in your documents"
 * instead of a confident answer built on noise.
 */
export async function searchChunks(queryVector: number[], { limit = 6, minScore = 0.25 } = {}): Promise<Source[]> {
  const pool = await db();
  const { rows } = await pool.query(
    `SELECT c.document_id, d.name AS document_name, c.page, c.content,
            1 - (c.embedding <=> $1::vector) AS score
       FROM chunks c
       JOIN documents d ON d.id = c.document_id
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2`,
    [toVector(queryVector), limit],
  );
  return rows
    .filter((r) => Number(r.score) >= minScore)
    .map((r, i) => ({
      n: i + 1,
      documentId: r.document_id,
      documentName: r.document_name,
      page: r.page,
      content: r.content,
      score: Number(r.score),
    }));
}

function toSummary(row: Record<string, unknown>): DocumentSummary {
  return {
    id: row.id as string,
    name: row.name as string,
    sizeBytes: row.size_bytes as number,
    pages: (row.pages as number | null) ?? null,
    chunkCount: row.chunk_count as number,
    createdAt: (row.created_at as Date).toISOString(),
  };
}
