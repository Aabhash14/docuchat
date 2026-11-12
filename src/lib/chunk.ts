export interface PageText {
  /** 1-based page number, or null for formats without pages (txt, md). */
  page: number | null;
  text: string;
}

export interface Chunk {
  ordinal: number;
  page: number | null;
  content: string;
}

export interface ChunkOptions {
  /** Target chunk length in characters. */
  size?: number;
  /** Characters repeated between neighbouring chunks so a sentence split at a boundary is still found. */
  overlap?: number;
}

/** Collapse runs of spaces/tabs but keep paragraph breaks, which are useful split points. */
export function normalize(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Find where to end a chunk that starts at `start`: as late as possible but no later than
 * `start + size`, preferring a paragraph break, then a sentence end, then a word boundary.
 */
function findBreak(text: string, start: number, size: number): number {
  const hardEnd = Math.min(start + size, text.length);
  if (hardEnd === text.length) return hardEnd;

  const window = text.slice(start, hardEnd);
  const minLength = Math.floor(size * 0.6);

  for (const pattern of [/\n\n/g, /[.!?]["')\]]?\s/g, /\n/g, /\s/g]) {
    let best = -1;
    for (const match of window.matchAll(pattern)) {
      const end = match.index + match[0].length;
      if (end >= minLength) best = end;
    }
    if (best !== -1) return start + best;
  }
  return hardEnd;
}

/** Split each page into overlapping chunks. Chunks never span pages, so every chunk has one page to cite. */
export function chunkPages(pages: PageText[], { size = 900, overlap = 150 }: ChunkOptions = {}): Chunk[] {
  if (overlap >= size) throw new Error("overlap must be smaller than size");

  const chunks: Chunk[] = [];
  for (const { page, text: raw } of pages) {
    const text = normalize(raw);
    let start = 0;
    while (start < text.length) {
      const end = findBreak(text, start, size);
      const content = text.slice(start, end).trim();
      if (content) chunks.push({ ordinal: chunks.length, page, content });
      if (end >= text.length) break;

      // Step back by `overlap`, then forward to the next word so chunks don't start mid-word.
      let next = Math.max(end - overlap, start + 1);
      const space = text.indexOf(" ", next);
      if (space !== -1 && space < end) next = space + 1;
      start = next;
    }
  }
  return chunks;
}
