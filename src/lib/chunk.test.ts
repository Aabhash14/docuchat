import { describe, expect, it } from "vitest";
import { chunkPages, normalize } from "./chunk";

const sentence = (i: number) => `Sentence number ${i} talks about something specific. `;
const longText = Array.from({ length: 60 }, (_, i) => sentence(i)).join("");

describe("normalize", () => {
  it("collapses spaces but keeps paragraph breaks", () => {
    expect(normalize("a   b\t c\r\n\r\n\r\n\r\nd")).toBe("a b c\n\nd");
  });
});

describe("chunkPages", () => {
  it("keeps short text in a single chunk", () => {
    const chunks = chunkPages([{ page: 1, text: "Short page." }]);
    expect(chunks).toEqual([{ ordinal: 0, page: 1, content: "Short page." }]);
  });

  it("respects the size limit and ends chunks on sentence boundaries", () => {
    const chunks = chunkPages([{ page: null, text: longText }], { size: 400, overlap: 80 });
    expect(chunks.length).toBeGreaterThan(5);
    for (const chunk of chunks) {
      expect(chunk.content.length).toBeLessThanOrEqual(400);
      expect(chunk.content.endsWith(".")).toBe(true);
    }
  });

  it("overlaps neighbouring chunks so no text is lost at a boundary", () => {
    const chunks = chunkPages([{ page: null, text: longText }], { size: 400, overlap: 80 });
    for (let i = 1; i < chunks.length; i++) {
      const tail = chunks[i - 1].content.slice(-40);
      expect(chunks[i].content.includes(tail.slice(tail.indexOf(" ") + 1))).toBe(true);
    }
    for (let i = 0; i < 60; i++) {
      expect(chunks.some((c) => c.content.includes(`number ${i} `))).toBe(true);
    }
  });

  it("never spans pages and numbers chunks across the whole document", () => {
    const chunks = chunkPages(
      [
        { page: 1, text: longText },
        { page: 2, text: "Page two text." },
      ],
      { size: 500, overlap: 100 },
    );
    const last = chunks.at(-1)!;
    expect(last).toMatchObject({ page: 2, content: "Page two text." });
    expect(chunks.map((c) => c.ordinal)).toEqual(chunks.map((_, i) => i));
  });

  it("skips empty pages", () => {
    expect(chunkPages([{ page: 1, text: "   \n\n " }])).toEqual([]);
  });

  it("rejects an overlap that is not smaller than the size", () => {
    expect(() => chunkPages([{ page: 1, text: "x" }], { size: 100, overlap: 100 })).toThrow();
  });
});
