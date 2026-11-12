/** Runs once when the server starts: load the embedding model now so the first upload or question doesn't wait for it. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { embedOne } = await import("./lib/embeddings");
  embedOne("warm up").catch((error) => console.error("Embedding model failed to load:", error));
}
