import type { Source } from "./store";

/** The chat endpoint streams newline-delimited JSON: one ChatEvent per line. */
export type ChatEvent =
  | { type: "sources"; sources: Source[]; mode: "llm" | "retrieval-only" }
  | { type: "text"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };

export const RETRIEVAL_ONLY_NOTE =
  "No language model is configured, so here are the most relevant passages from your documents. " +
  "Set ANTHROPIC_API_KEY to get a written answer with citations.";

export const NO_MATCH_NOTE =
  "I couldn't find anything about that in your documents. Try rephrasing, or upload a document that covers it.";
