"use client";

import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Chat, type Message } from "@/components/Chat";
import type { DocumentSummary } from "@/lib/store";
import type { ChatEvent } from "@/lib/protocol";

export interface Status {
  llm: string | null;
  embeddings: string;
}

export interface Upload {
  name: string;
  error?: string;
}

export default function Home() {
  const [documents, setDocuments] = useState<DocumentSummary[] | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const busy = messages.some((m) => m.pending);

  const refreshDocuments = useCallback(async () => {
    const res = await fetch("/api/documents");
    if (!res.ok) throw new Error("Couldn't load your documents. Is the database running?");
    setDocuments((await res.json()).documents);
  }, []);

  useEffect(() => {
    refreshDocuments().catch((e: Error) => setLoadError(e.message));
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, [refreshDocuments]);

  async function uploadFiles(files: File[]) {
    for (const file of files) {
      setUploads((u) => [...u.filter((x) => x.name !== file.name), { name: file.name }]);
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/documents", { method: "POST", body }).catch(() => null);
      if (res?.ok) {
        setUploads((u) => u.filter((x) => x.name !== file.name));
        await refreshDocuments();
      } else {
        const error = res ? ((await res.json().catch(() => null))?.error ?? "Upload failed.") : "Upload failed.";
        setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, error } : x)));
      }
    }
  }

  async function removeDocument(id: string) {
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    await refreshDocuments();
  }

  async function ask(question: string) {
    const history = messages
      .filter((m) => !m.pending && !m.error && m.content)
      .map((m) => ({ role: m.role, content: m.content }));
    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: question };
    const answerId = crypto.randomUUID();
    setMessages((ms) => [...ms, userMessage, { id: answerId, role: "assistant", content: "", pending: true }]);
    const update = (patch: (m: Message) => Partial<Message>) =>
      setMessages((ms) => ms.map((m) => (m.id === answerId ? { ...m, ...patch(m) } : m)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok || !res.body) {
        const error = (await res.json().catch(() => null))?.error ?? "The server couldn't answer.";
        update(() => ({ error, pending: false }));
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ChatEvent;
          if (event.type === "sources") update(() => ({ sources: event.sources, mode: event.mode }));
          else if (event.type === "text") update((m) => ({ content: m.content + event.text }));
          else if (event.type === "error") update(() => ({ error: event.message }));
        }
      }
    } catch {
      update(() => ({ error: "Lost the connection to the server." }));
    } finally {
      update(() => ({ pending: false }));
    }
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <Sidebar
        documents={documents}
        uploads={uploads}
        status={status}
        loadError={loadError}
        onUpload={uploadFiles}
        onDelete={removeDocument}
        onDismissUpload={(name) => setUploads((u) => u.filter((x) => x.name !== name))}
      />
      <Chat
        messages={messages}
        busy={busy}
        hasDocuments={(documents?.length ?? 0) > 0}
        onAsk={ask}
        onClear={() => setMessages([])}
      />
    </div>
  );
}
