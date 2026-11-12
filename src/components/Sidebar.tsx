"use client";

import { useRef, useState } from "react";
import type { DocumentSummary } from "@/lib/store";
import type { Status, Upload } from "@/app/page";

interface SidebarProps {
  documents: DocumentSummary[] | null;
  uploads: Upload[];
  status: Status | null;
  loadError: string | null;
  onUpload: (files: File[]) => void;
  onDelete: (id: string) => void;
  onDismissUpload: (name: string) => void;
}

export function Sidebar({ documents, uploads, status, loadError, onUpload, onDelete, onDismissUpload }: SidebarProps) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-zinc-200 bg-zinc-50 md:h-full md:w-80 md:border-r md:border-b-0 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="grid size-8 place-items-center rounded-lg bg-accent-600 text-white" aria-hidden>
          <svg viewBox="0 0 24 24" className="size-4.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M7 3h7l5 5v13H7z" strokeLinejoin="round" />
            <path d="M14 3v5h5M10 13h6M10 17h4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <h1 className="text-[15px] leading-tight font-semibold">DocuChat</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Answers from your documents</p>
        </div>
      </header>

      <div className="px-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onUpload(Array.from(e.dataTransfer.files));
          }}
          className={`flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${
            dragging
              ? "border-accent-500 bg-accent-50 dark:bg-accent-700/20"
              : "border-zinc-300 hover:border-accent-500 hover:bg-white dark:border-zinc-700 dark:hover:bg-zinc-800"
          }`}
        >
          <span className="text-sm font-medium">Upload documents</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">PDF, TXT or Markdown, up to 10 MB</span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.txt,.md"
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            onUpload(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <h2 className="mb-2 px-1 text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Your documents
        </h2>

        {loadError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{loadError}</p>}

        <ul className="space-y-1.5" aria-label="Documents">
          {uploads.map((u) => (
            <li
              key={`upload-${u.name}`}
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                u.error
                  ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="truncate font-medium">{u.name}</span>
                {u.error && (
                  <button
                    onClick={() => onDismissUpload(u.name)}
                    className="text-xs text-red-700 hover:underline dark:text-red-300"
                  >
                    Dismiss
                  </button>
                )}
              </div>
              <p className={`mt-0.5 text-xs ${u.error ? "text-red-700 dark:text-red-300" : "text-zinc-500"}`}>
                {u.error ?? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-accent-500" /> Reading and indexing…
                  </span>
                )}
              </p>
            </li>
          ))}

          {documents?.map((doc) => (
            <li
              key={doc.id}
              className="group flex items-start justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={doc.name}>
                  {doc.name}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {[doc.pages ? `${doc.pages} page${doc.pages === 1 ? "" : "s"}` : null, formatBytes(doc.sizeBytes), `${doc.chunkCount} passages`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                onClick={() => onDelete(doc.id)}
                aria-label={`Delete ${doc.name}`}
                className="rounded p-1 text-zinc-400 opacity-60 transition group-hover:opacity-100 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>

        {documents?.length === 0 && uploads.length === 0 && (
          <p className="px-1 text-sm text-zinc-500 dark:text-zinc-400">
            No documents yet. Upload a policy, manual or report to start asking questions.
          </p>
        )}
      </div>

      <footer className="hidden border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500 md:block dark:border-zinc-800 dark:text-zinc-400">
        <p>
          Answers:{" "}
          {status ? (
            status.llm ? (
              <span className="text-zinc-700 dark:text-zinc-300">{status.llm}</span>
            ) : (
              <span>passages only (no API key)</span>
            )
          ) : (
            "…"
          )}
        </p>
        <p>Search: local embeddings + pgvector</p>
      </footer>
    </aside>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
