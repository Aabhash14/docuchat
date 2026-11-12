import { expect, test, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const policy = readFileSync(path.join(__dirname, "../samples/acme-remote-work-policy.md"));

/** A unique file name per test, so tests only ever see and clean up their own documents. */
function uniqueName(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.md`;
}

async function deleteByName(request: APIRequestContext, name: string) {
  const { documents } = await (await request.get("/api/documents")).json();
  for (const doc of documents.filter((d: { name: string }) => d.name === name)) {
    await request.delete(`/api/documents/${doc.id}`);
  }
}

test.describe("documents", () => {
  test("uploading a document lists it with its passage count", async ({ page, request }) => {
    const name = uniqueName("policy");
    await page.goto("/");
    await page.getByTestId("file-input").setInputFiles({ name, mimeType: "text/markdown", buffer: policy });

    const item = page.getByRole("list", { name: "Documents" }).getByRole("listitem").filter({ hasText: name });
    await expect(item).toContainText(/\d+ passages/);
    await deleteByName(request, name);
  });

  test("a PDF is indexed page by page, and answers cite the page", async ({ page, request }) => {
    // Build a two-page PDF in the browser, so the test needs no binary fixture.
    await page.setContent(
      `<h1>Travel Expense Policy</h1><p>Economy class is required for flights under six hours.</p>
       <div style="page-break-before: always"></div>
       <h2>Meals</h2><p>The daily meal allowance is 45 euros domestically and 60 euros abroad.</p>`,
    );
    const pdf = await page.pdf();
    const name = uniqueName("travel").replace(/\.md$/, ".pdf");

    const res = await request.post("/api/documents", { multipart: { file: { name, mimeType: "application/pdf", buffer: pdf } } });
    expect(res.status()).toBe(201);
    const { document } = await res.json();
    expect(document).toMatchObject({ pages: 2, sizeBytes: pdf.length });

    const chat = await request.post("/api/chat", { data: { question: "What is the meal allowance abroad?" } });
    const events = (await chat.text()).trim().split("\n").map((line) => JSON.parse(line));
    expect(events[0].sources[0]).toMatchObject({ documentName: name, page: 2 });

    await deleteByName(request, name);
  });

  test("an unsupported file type is rejected with a clear message", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("file-input").setInputFiles({ name: "malware.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") });

    const item = page.getByRole("listitem").filter({ hasText: "malware.exe" });
    await expect(item).toContainText("isn't supported");
    await item.getByRole("button", { name: "Dismiss" }).click();
    await expect(item).toHaveCount(0);
  });

  test("deleting a document removes it from the list", async ({ page, request }) => {
    const name = uniqueName("to-delete");
    await request.post("/api/documents", { multipart: { file: { name, mimeType: "text/markdown", buffer: policy } } });

    await page.goto("/");
    await page.getByRole("button", { name: `Delete ${name}` }).click();
    await expect(page.getByText(name)).toHaveCount(0);
  });
});

test.describe("chat", () => {
  let name: string;

  test.beforeEach(async ({ request }) => {
    name = uniqueName("policy");
    const res = await request.post("/api/documents", { multipart: { file: { name, mimeType: "text/markdown", buffer: policy } } });
    expect(res.status()).toBe(201);
  });

  test.afterEach(async ({ request }) => {
    await deleteByName(request, name);
  });

  test("a question returns sources from the matching document", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("textbox", { name: "Question" }).fill("How many days per week can employees work remotely?");
    await page.getByRole("button", { name: "Ask" }).click();

    const answer = page.getByTestId("answer").last();
    const sources = answer.getByRole("region", { name: "Sources" });
    await expect(sources).toBeVisible();
    // The best-matching passage is the one that states the rule.
    await expect(sources.getByRole("listitem").first()).toContainText("three days per week");
    await expect(page.getByRole("button", { name: "Ask" })).toBeVisible(); // no longer "Answering…"
  });

  test("the chat API rejects an empty question", async ({ request }) => {
    const res = await request.post("/api/chat", { data: { question: "   " } });
    expect(res.status()).toBe(400);
  });
});
