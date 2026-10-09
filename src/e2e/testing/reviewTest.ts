import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

import { createGitRepository } from "../../integration/testing/createGitRepository";
import type { CliResult, RunningCli } from "../../integration/testing/startCli";
import { startCli } from "../../integration/testing/startCli";
import { stopReviewServer } from "../../integration/testing/stopReviewServer";

export const plan = [
  "# Plan",
  "",
  "We cache results for **24h** today. See the [spec](spec.md#goals).",
  "",
  "Retries happen three times.",
  "",
].join("\n");

/**
 * @returns the doc's source followed by paragraphs numbered from "Paragraph 1.", enough of them to make it scroll
 */
export function withParagraphs(source: string, count: number): string {
  return [source, ...Array.from({ length: count }, (_, index) => `Paragraph ${index + 1}.`)].join("\n\n");
}

/**
 * Scrolls the doc column to its end, as dragging its scrollbar to the bottom would
 */
export function scrollDocumentToEnd(page: Page): Promise<void> {
  return page.getByRole("main").evaluate((main) => main.scrollTo(0, main.scrollHeight));
}

const spec = "# Spec\n\n## Goals\n\nResults are cached.\n";

export interface ReviewFixture {
  /**
   * Runs the agent's `open` for the doc and shows the page it prints in the browser
   */
  open(document: string): Promise<void>;

  root: string;
  run(args: string[]): Promise<CliResult>;

  /**
   * Starts the agent's `poll` and waits until the page says the agent is waiting
   */
  startPoll(): Promise<RunningCli>;

  writeDocument(document: string, source: string): Promise<void>;
}

/**
 * Playwright's test, given a fresh git repository holding `docs/plan.md` and `docs/spec.md` and the CLI to review it
 * with; a test fails if the page logs an error, such as a Content Security Policy violation
 */
export const test = base.extend<{ review: ReviewFixture }>({
  review: async ({ page }, runTest) => {
    const root = await createGitRepository({ "docs/plan.md": plan, "docs/spec.md": spec });
    const errors = collectErrors(page);
    await runTest({
      open: async (document) => {
        const { stdout } = await startCli(root, ["open", document]).result;
        await page.goto(stdout.slice(stdout.indexOf("http"), stdout.indexOf("\n")));
        await expect(page.getByRole("heading", { level: 1, name: document })).toBeVisible();
      },
      root,
      run: (args) => startCli(root, args).result,
      startPoll: async () => {
        const poll = startCli(root, ["poll", "--timeout", "60"]);
        await expect(page.getByRole("status")).toHaveText("Agent waiting");
        return poll;
      },
      writeDocument: (document, source) => writeFile(path.join(root, ...document.split("/")), source),
    });
    const errorsDuringTest = [...errors];
    await stopReviewServer(root);
    await rm(root, { force: true, recursive: true });
    expect(errorsDuringTest).toEqual([]);
  },
});

/**
 * Selects text in the doc on the page, as dragging across it would
 *
 * @param from the text the selection starts with
 * @param through the text it ends with, which may be in a later element
 */
export async function selectText(page: Page, from: string, through: string): Promise<void> {
  await page.getByRole("article", { name: "docs/plan.md" }).evaluate(
    (article, { endText, startText }) => {
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let hasStart = false;
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const data = node.textContent ?? "";
        if (!hasStart && data.includes(startText)) {
          range.setStart(node, data.indexOf(startText));
          hasStart = true;
        }
        if (hasStart && data.includes(endText)) {
          range.setEnd(node, data.indexOf(endText) + endText.length);
          getSelection()?.removeAllRanges();
          getSelection()?.addRange(range);
          return;
        }
      }
      throw new Error(`The doc has no text from "${startText}" through "${endText}"`);
    },
    { endText: through, startText: from }
  );
}

/**
 * Comments on text in the doc the way the user does, and saves the comment as a draft
 *
 * @param from the text the comment's passage starts with
 * @param through the text it ends with
 * @param body the comment
 */
export async function writeDraftComment(page: Page, from: string, through: string, body: string): Promise<void> {
  await selectText(page, from, through);
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await page.keyboard.type(body);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("region", { name: "Drafts" })).toBeVisible();
}

/**
 * Submits the user's drafts from the review bar
 *
 * @param draftCount how many drafts the submit button counts
 * @param verdict the menu's button for the verdict
 */
export async function submitDrafts(
  page: Page,
  draftCount: number,
  verdict: "Approve" | "Request changes"
): Promise<void> {
  await page.getByRole("button", { name: `Submit (${draftCount})` }).click();
  await page.getByRole("button", { name: verdict }).click();
}

/**
 * @returns the text of each passage the page highlights as a thread
 */
export function highlightedText(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...(CSS.highlights.get("markdown-review-threads") ?? [])].map((range) => range.toString())
  );
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
