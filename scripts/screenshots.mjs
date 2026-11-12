// Captures the README screenshots from a running dev server: `npm run dev`, then `npm run screenshots`.
import { chromium } from "@playwright/test";
import { readdirSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3100";
const OUT = "docs/screenshots";
const QUESTION = process.env.QUESTION ?? "How many days a week can I work from home, and what's the home office allowance?";

const existing = (await (await fetch(`${BASE}/api/documents`)).json()).documents.map((d) => d.name);
for (const file of readdirSync("samples")) {
  if (existing.includes(file)) continue;
  const body = new FormData();
  body.append("file", new Blob([readFileSync(path.join("samples", file))]), file);
  const res = await fetch(`${BASE}/api/documents`, { method: "POST", body });
  if (!res.ok) throw new Error(`Uploading ${file} failed: ${await res.text()}`);
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: scheme });
  await page.goto(BASE);
  await page.getByText("acme-remote-work-policy.md").waitFor();
  if (scheme === "light") await page.screenshot({ path: `${OUT}/empty-${scheme}.png` });

  await page.getByRole("textbox", { name: "Question" }).fill(QUESTION);
  await page.getByRole("button", { name: "Ask" }).click();
  await page.getByRole("button", { name: "Ask" }).waitFor({ timeout: 120_000 }); // answer finished streaming
  // Start the shot at the question, not at the bottom of the source cards.
  await page.getByText(QUESTION).evaluate((el) => el.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/answer-${scheme}.png` });
  await page.close();
}

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
await mobile.goto(BASE);
await mobile.getByText("acme-remote-work-policy.md").waitFor();
await mobile.screenshot({ path: `${OUT}/mobile.png` });

await browser.close();
console.log(`Screenshots saved to ${OUT}/`);
