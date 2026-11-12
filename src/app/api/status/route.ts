import { isLlmConfigured, CLAUDE_MODEL } from "@/lib/answer";
import { EMBEDDING_MODEL } from "@/lib/embeddings";

export const runtime = "nodejs";

export function GET() {
  return Response.json({
    llm: isLlmConfigured() ? CLAUDE_MODEL : null,
    embeddings: EMBEDDING_MODEL,
  });
}
