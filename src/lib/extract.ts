import { extractText, getDocumentProxy } from "unpdf";
import type { PageText } from "./chunk";

export const SUPPORTED_EXTENSIONS = [".pdf", ".txt", ".md"] as const;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export class UnsupportedFileError extends Error {}

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export function isSupported(filename: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}

/** Extract text per page, so answers can cite "page 4" for PDFs. */
export async function extractPages(filename: string, data: Uint8Array): Promise<PageText[]> {
  const ext = extensionOf(filename);

  if (ext === ".pdf") {
    const pdf = await getDocumentProxy(data);
    const { text } = await extractText(pdf, { mergePages: false });
    return text.map((pageText, i) => ({ page: i + 1, text: pageText }));
  }

  if (ext === ".txt" || ext === ".md") {
    return [{ page: null, text: new TextDecoder("utf-8").decode(data) }];
  }

  throw new UnsupportedFileError(`Unsupported file type "${ext || filename}". Upload a PDF, TXT or Markdown file.`);
}
