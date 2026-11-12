import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { embedOne } from "@/lib/embeddings";
import { searchChunks } from "@/lib/store";
import { isLlmConfigured, streamAnswer } from "@/lib/answer";
import { NO_MATCH_NOTE, RETRIEVAL_ONLY_NOTE, type ChatEvent } from "@/lib/protocol";

export const runtime = "nodejs";

const ChatRequest = z.object({
  question: z.string().trim().min(1, "Ask a question.").max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20000) }))
    .max(20)
    .default([]),
});

export async function POST(request: Request) {
  const parsed = ChatRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }
  const { question, history } = parsed.data;

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const sources = await searchChunks(await embedOne(question));
        const llm = isLlmConfigured();
        send({ type: "sources", sources, mode: llm ? "llm" : "retrieval-only" });

        if (!llm) {
          send({ type: "text", text: sources.length ? RETRIEVAL_ONLY_NOTE : NO_MATCH_NOTE });
        } else {
          // Keep only recent turns: older ones rarely help and cost tokens on every request.
          for await (const text of streamAnswer(question, sources, history.slice(-6))) {
            send({ type: "text", text });
          }
        }
        send({ type: "done" });
      } catch (error) {
        console.error("chat failed", error);
        send({ type: "error", message: describeError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache" },
  });
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (error instanceof Anthropic.RateLimitError) return "The language model is rate limited right now. Try again in a moment.";
  if (error instanceof Anthropic.APIConnectionError) return "Couldn't reach the language model. Check your connection.";
  if (error instanceof Anthropic.APIError) return `The language model returned an error (${error.status ?? "unknown"}).`;
  if (error instanceof Error && /ECONNREFUSED|DATABASE_URL/.test(error.message)) {
    return "Can't reach the database. Is it running? (docker compose up -d db)";
  }
  return "Something went wrong while answering. Check the server logs.";
}
