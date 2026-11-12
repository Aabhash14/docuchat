"use client";

import { useEffect, useRef, useState } from "react";
import type { Source } from "@/lib/store";
import { Answer } from "./Answer";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  mode?: "llm" | "retrieval-only";
  pending?: boolean;
  error?: string;
}

interface ChatProps {
  messages: Message[];
  busy: boolean;
  hasDocuments: boolean;
  onAsk: (question: string) => void;
  onClear: () => void;
}

const SUGGESTIONS = ["Summarize the key points", "What are the main deadlines?", "What does it say about costs?"];

export function Chat({ messages, busy, hasDocuments, onAsk, onClear }: ChatProps) {
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const canSend = hasDocuments && !busy && draft.trim().length > 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function send(question = draft) {
    if (!hasDocuments || busy || !question.trim()) return;
    onAsk(question.trim());
    setDraft("");
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-medium">Chat</h2>
        {messages.length > 0 && (
          <button onClick={onClear} disabled={busy} className="text-xs text-zinc-500 hover:text-zinc-900 disabled:opacity-40 dark:hover:text-zinc-100">
            New chat
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
          {messages.length === 0 && (
            <div className="pt-12 text-center sm:pt-20">
              <h3 className="text-xl font-semibold">Ask anything about your documents</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
                {hasDocuments
                  ? "Every answer links back to the passages it came from, so you can check it."
                  : "Upload a document on the left to get started."}
              </p>
              {hasDocuments && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-sm text-zinc-700 hover:border-accent-500 hover:text-accent-700 dark:border-zinc-700 dark:text-zinc-300"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] rounded-2xl rounded-br-md bg-accent-600 px-4 py-2.5 text-[15px] whitespace-pre-wrap text-white">
                  {m.content}
                </p>
              </div>
            ) : (
              <Answer key={m.id} message={m} />
            ),
          )}
          <div ref={bottom} />
        </div>
      </div>

      <form
        className="border-t border-zinc-200 p-3 sm:p-4 dark:border-zinc-800"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-zinc-300 bg-white p-2 focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-100 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:ring-accent-700/30">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder={hasDocuments ? "Ask a question…" : "Upload a document first"}
            aria-label="Question"
            disabled={!hasDocuments}
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-zinc-400 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="h-10 rounded-xl bg-accent-600 px-4 text-sm font-medium text-white transition hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Answering…" : "Ask"}
          </button>
        </div>
      </form>
    </main>
  );
}
