import Anthropic from "@anthropic-ai/sdk";
import type { Source } from "./store";

export const CLAUDE_MODEL = "claude-opus-5-5";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM_PROMPT = `You answer questions about the user's own documents for DocuChat.

Each user message contains numbered passages retrieved from their documents, followed by the question.
Answer only from those passages. Cite every claim with the passage number in square brackets, like [1] or [2][3], placed right after the claim.
If the passages don't contain the answer, say so plainly and suggest what document might contain it. Do not fill gaps from general knowledge.
Keep answers short and direct. Use a bulleted list only when the answer is a list of items.`;

function formatSources(sources: Source[]): string {
  if (sources.length === 0) return "(No passages matched this question.)";
  return sources
    .map((s) => {
      const where = s.page === null ? s.documentName : `${s.documentName}, page ${s.page}`;
      return `<passage n="${s.n}" source="${where}">\n${s.content}\n</passage>`;
    })
    .join("\n\n");
}

/**
 * Streams Claude's answer as text deltas. Earlier turns carry only the question and answer text;
 * each turn's passages are retrieved fresh for its own question.
 */
export async function* streamAnswer(question: string, sources: Source[], history: ChatTurn[]): AsyncGenerator<string> {
  const client = new Anthropic();

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    {
      role: "user",
      content: `<passages>\n${formatSources(sources)}\n</passages>\n\nQuestion: ${question}`,
    },
  ];

  const stream = client.beta.messages.stream({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    // Grounded Q&A over short passages doesn't need deep reasoning; low effort keeps answers fast.
    output_config: { effort: "low" },
    // If the model declines for policy reasons, the API retries on its default fallback model.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    yield "\n\nI can't help with that request.";
  } else if (final.stop_reason === "max_tokens") {
    yield "\n\n(Answer cut off at the length limit.)";
  }
}
