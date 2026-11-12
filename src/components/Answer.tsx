"use client";

import ReactMarkdown from "react-markdown";
import type { Source } from "@/lib/store";
import type { Message } from "./Chat";

/** Turn "[2]" citations into markdown links to the matching source card, so they render as chips. */
function linkCitations(text: string, messageId: string, sourceCount: number): string {
  return text.replace(/\[(\d{1,2})\](?!\()/g, (match, n: string) =>
    Number(n) >= 1 && Number(n) <= sourceCount ? `[${n}](#${sourceAnchor(messageId, Number(n))})` : match,
  );
}

const sourceAnchor = (messageId: string, n: number) => `m-${messageId}-s${n}`;

/** Passages from Markdown files keep their syntax; drop the common markers so the excerpt reads as prose. */
const plainText = (text: string) =>
  text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|\s)_(.+?)_(?=\s|$|[.,;:])/g, "$1$2");

export function Answer({ message }: { message: Message }) {
  const sources = message.sources ?? [];
  const thinking = message.pending && !message.content;

  return (
    <article className="space-y-3" data-testid="answer">
      {thinking && (
        <p className="flex items-center gap-2 text-sm text-zinc-500">
          <span className="flex gap-1" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="size-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
          {message.sources ? "Writing an answer…" : "Searching your documents…"}
        </p>
      )}

      {message.content && (
        <div className={`answer text-[15px] leading-relaxed ${message.mode === "retrieval-only" ? "text-zinc-600 dark:text-zinc-400" : ""}`}>
          <ReactMarkdown
            components={{
              a: ({ href, children }) =>
                href?.startsWith("#m-") ? (
                  <a
                    href={href}
                    className="mx-0.5 inline-grid h-[1.15rem] min-w-[1.15rem] place-items-center rounded-md bg-accent-100 px-1 align-[0.1em] text-[0.7rem] font-semibold text-accent-700 no-underline hover:bg-accent-600 hover:text-white dark:bg-accent-700/30 dark:text-accent-100"
                  >
                    {children}
                  </a>
                ) : (
                  <a href={href} target="_blank" rel="noreferrer" className="text-accent-600 underline">
                    {children}
                  </a>
                ),
            }}
          >
            {linkCitations(message.content, message.id, sources.length)}
          </ReactMarkdown>
        </div>
      )}

      {message.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {message.error}
        </p>
      )}

      {sources.length > 0 && (
        <section aria-label="Sources">
          <h4 className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">Sources</h4>
          <ol className="grid items-start gap-2 sm:grid-cols-2">
            {sources.map((s) => (
              // Without a written answer the best passage is the answer, so show it expanded.
              <SourceCard key={s.n} source={s} anchor={sourceAnchor(message.id, s.n)} open={message.mode === "retrieval-only" && s.n === 1} />
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

function SourceCard({ source, anchor, open }: { source: Source; anchor: string; open: boolean }) {
  return (
    <li id={anchor} className="source-card rounded-lg border border-zinc-200 bg-zinc-50 text-sm dark:border-zinc-800 dark:bg-zinc-900">
      <details open={open} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2">
          <span className="grid size-5 shrink-0 place-items-center rounded-md bg-accent-100 text-[0.7rem] font-semibold text-accent-700 dark:bg-accent-700/30 dark:text-accent-100">
            {source.n}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium" title={source.documentName}>
            {source.documentName}
          </span>
          <span className="shrink-0 text-xs text-zinc-500" title="Cosine similarity between the question and this passage">
            {source.page !== null && `p. ${source.page} · `}
            {source.score.toFixed(2)}
          </span>
        </summary>
        <p className="max-h-56 overflow-y-auto border-t border-zinc-200 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          {plainText(source.content)}
        </p>
      </details>
    </li>
  );
}
