import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

/**
 * Embeddings run locally (all-MiniLM-L6-v2 via ONNX), so indexing documents needs no API key
 * and document text never leaves the server just to be indexed.
 */
export const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
export const EMBEDDING_DIMENSIONS = 384;

const BATCH_SIZE = 32;

const globalForEmbedder = globalThis as unknown as { embedder?: Promise<FeatureExtractionPipeline> };

function getEmbedder(): Promise<FeatureExtractionPipeline> {
  // Cached on globalThis so dev-server hot reloads don't load the model again.
  globalForEmbedder.embedder ??= pipeline("feature-extraction", EMBEDDING_MODEL, { dtype: "fp32" });
  return globalForEmbedder.embedder;
}

/** Returns one L2-normalised vector per input, so cosine similarity is a dot product. */
export async function embed(texts: string[]): Promise<number[][]> {
  const embedder = await getEmbedder();
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const output = await embedder(texts.slice(i, i + BATCH_SIZE), { pooling: "mean", normalize: true });
    vectors.push(...(output.tolist() as number[][]));
  }
  return vectors;
}

export async function embedOne(text: string): Promise<number[]> {
  const [vector] = await embed([text]);
  return vector;
}
