import { mkdir } from "node:fs/promises";
import path from "node:path";

import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { ReviewFixture } from "../e2e/testing/reviewTest";
import {
  boxOf,
  saveNewComment,
  submitButtonName,
  submitDrafts,
  test,
  writeDraftComment,
} from "../e2e/testing/reviewTest";

import type { Clip } from "./testing/shootInBothModes";
import { planAfter, planBefore, planPath, renderedPlan, rollout, rolloutPath } from "./testing/demoDocuments";
import { shootInBothModes } from "./testing/shootInBothModes";

test("a review in progress, its comments, and the Submit review popover", async ({ page, review }) => {
  await writeDocuments(review, { [planPath]: planBefore });
  const { stdout } = await review.run(["open", planPath, "--next-task", "build the limiter in src/api/rateLimit.ts"]);
  await page.goto(stdout.slice(stdout.indexOf("http"), stdout.indexOf("\n")));
  const article = page.getByRole("article", { name: planPath });
  await expect(article.locator("[data-mermaid-definition] > svg")).toBeVisible();

  const firstRound = await review.startPoll();
  await writeDraftComment(
    page,
    "stored in Redis",
    "the same count.",
    "What happens when Redis is down? I'd rather fail open than reject every request.",
    planPath
  );
  await article.getByRole("row", { name: /Enterprise/ }).hover();
  await page.getByRole("button", { name: "Comment on this block" }).click();
  await saveNewComment(
    page,
    "Enterprise customers negotiate their own limits, so read these from the plan record instead of hard-coding them."
  );
  await page.getByRole("button", { name: "New comment" }).click();
  await page.getByRole("button", { name: "On this doc" }).click();
  await saveNewComment(page, "Looks good overall. Add a section on how we'll know it's working once it's live.");
  await submitDrafts(page, 3, "Revise");
  await firstRound.result;

  await review.writeDocument(planPath, planAfter);
  await review.run(["resolve", "1", "Added a Failure modes section: the limiter fails open and logs a warning."]);
  await review.run([
    "reply",
    "2",
    "Should a single API key be able to override its plan's limits too, or only the plan as a whole?",
  ]);
  await review.run(["resolve", "3", "Added a Monitoring section with a dashboard and an alert on the 429 rate."]);
  await review.startPoll();
  await expect(article.getByRole("heading", { name: "Failure modes" })).toBeAttached();
  await expect(article.locator("[data-mermaid-definition] > svg")).toBeVisible();
  await expect(page.getByText("Should a single API key be able to override")).toBeVisible();
  await expect(page.getByText("Added a Monitoring section")).toBeAttached();

  await writeDraftComment(
    page,
    "The bucket refills",
    "up to its burst.",
    "Does a new key's bucket start full? Say so, since it decides whether a new client can burst at once.",
    planPath
  );
  await scrollToTop(article.getByRole("heading", { name: "Approach" }));
  await shootInBothModes(page, "review");

  const comments = await commentsColumn(page);
  await shootInBothModes(page, "threads", comments);

  await page.getByRole("button", { exact: true, name: submitButtonName(1) }).click();
  const popover = await boxOf(page.getByRole("dialog", { name: "Submit review" }));
  const top = Math.floor(popover.y - 70);
  await shootInBothModes(page, "submit", { ...comments, height: comments.y + comments.height - top, y: top });
});

test("the frame round a table that the bracket in the margin comments on", async ({ page, review }) => {
  await writeDocuments(review, { [planPath]: planBefore });
  await review.open(planPath);
  const article = page.getByRole("article", { name: planPath });
  const heading = article.getByRole("heading", { name: "Approach" });
  await scrollToTop(heading);

  const table = await boxOf(article.getByRole("table"));
  const lane = await boxOf(page.getByTestId("bracket-lane"));
  await page.mouse.move(lane.x + lane.width / 2, table.y + table.height / 2);
  await expect(page.getByTestId("block-target")).toContainText("Comment on the table");

  const top = (await boxOf(heading)).y - 24;
  const left = lane.x - 32;
  const prose = await boxOf(article);
  await shootInBothModes(page, "blocks", {
    height: table.y + table.height + 40 - top,
    width: prose.x + prose.width + 32 - left,
    x: left,
    y: top,
  });
});

test("comments on a set of docs, under All docs", async ({ page, review }) => {
  await writeDocuments(review, { [planPath]: planBefore, [rolloutPath]: rollout });
  await review.open(planPath);
  await review.startPoll();
  await writeDraftComment(
    page,
    "stored in Redis",
    "the same count.",
    "What happens when Redis is down? I'd rather fail open than reject every request.",
    planPath
  );
  await page
    .getByRole("article", { name: planPath })
    .getByRole("row", { name: /Enterprise/ })
    .hover();
  await page.getByRole("button", { name: "Comment on this block" }).click();
  await saveNewComment(
    page,
    "Enterprise customers negotiate their own limits, so read these from the plan record instead of hard-coding them."
  );
  await review.open(rolloutPath);
  await writeDraftComment(
    page,
    "We email the owner",
    "it will get.",
    "Send it a week before we enforce the limit, so customers have time to ask for more.",
    rolloutPath
  );
  await page.getByRole("tab", { name: /^All docs/ }).click();

  await shootInBothModes(page, "documents", await commentsColumn(page));
});

test.describe("in a window tall enough for the whole doc", () => {
  test.use({ viewport: { height: 1400, width: 1400 } });

  test("the kinds of content a doc renders", async ({ page, review }) => {
    await writeDocuments(review, { [planPath]: renderedPlan });
    await review.open(planPath);
    const article = page.getByRole("article", { name: planPath });
    await expect(article.locator("[data-mermaid-definition] > svg")).toBeVisible();

    const box = await boxOf(article);
    const top = (await boxOf(page.getByRole("main"))).y + 1;
    await shootInBothModes(page, "rendering", {
      height: box.y + box.height + 24 - top,
      width: box.width + 48,
      x: box.x - 24,
      y: top,
    });
  });
});

/**
 * Writes docs into the review's repository, creating their directories
 *
 * @param documents each doc's source, by repo-relative path
 */
async function writeDocuments(review: ReviewFixture, documents: Record<string, string>): Promise<void> {
  for (const [document, source] of Object.entries(documents)) {
    await mkdir(path.dirname(path.join(review.root, ...document.split("/"))), { recursive: true });
    await review.writeDocument(document, source);
  }
}

/**
 * Scrolls the doc column until the element sits just below its top
 */
async function scrollToTop(element: Locator): Promise<void> {
  await element.evaluate((target) => {
    const column = target.closest("main");
    column?.scrollTo(0, target.getBoundingClientRect().top + column.scrollTop - 80);
  });
  await expect.poll(async () => (await boxOf(element)).y).toBeLessThan(160);
}

/**
 * Scrolls the comments column to its top
 *
 * @returns the comments column, from the doc column's right edge to the window's, and from below the top bar to the
 *   window's bottom
 */
async function commentsColumn(page: Page): Promise<Clip> {
  await page.getByRole("complementary", { name: "Comments" }).evaluate((comments) => {
    for (let element: Element | null = comments; element !== null; element = element.parentElement) {
      element.scrollTop = 0;
    }
  });
  const documentColumn = await boxOf(page.getByRole("main"));
  const viewport = page.viewportSize();
  if (viewport === null) {
    throw new Error("The page has no viewport size");
  }
  const left = documentColumn.x + documentColumn.width;
  return { height: viewport.height - documentColumn.y, width: viewport.width - left, x: left, y: documentColumn.y };
}
