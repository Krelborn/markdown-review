import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { ReviewFixture } from "./testing/reviewTest";
import {
  plan,
  scrollDocumentToEnd,
  selectText,
  submitButtonName,
  test,
  withParagraphs,
  writeDraftComment,
} from "./testing/reviewTest";

const narrowWindow = { height: 800, width: 700 };

const wideWindow = { height: 720, width: 1280 };

const phoneWindow = { height: 800, width: 470 };

test("must keep the header and Submit in view, and the window still, when the user scrolls to the end of a long doc", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", withParagraphs(plan, 80));
  await review.open("docs/plan.md");

  await scrollDocumentToEnd(page);

  await expect(page.getByText("Paragraph 80.", { exact: true })).toBeInViewport();
  await expect(page.getByRole("heading", { level: 1, name: "docs/plan.md" })).toBeInViewport();
  await expect(page.getByRole("status")).toBeInViewport();
  await expect(page.getByRole("button", { exact: true, name: submitButtonName(0) })).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)
  ).toBe(true);
});

test("must show a linked doc at the heading its link names when the heading is far down the doc", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/spec.md", `${withParagraphs("# Spec", 80)}\n\n## Goals\n\nResults are cached.\n`);
  await review.open("docs/plan.md");

  await page.getByRole("link", { name: "spec" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "docs/spec.md" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Goals" })).toBeInViewport();
});

test("must keep the user's place in a long doc when the agent edits it", async ({ page, review }) => {
  const source = withParagraphs(plan, 80);
  await review.writeDocument("docs/plan.md", source);
  await review.open("docs/plan.md");
  await page.getByText("Paragraph 60.", { exact: true }).scrollIntoViewIfNeeded();
  const scrolledTo = await documentScrollTop(page);
  expect(scrolledTo).toBeGreaterThan(0);

  await review.writeDocument("docs/plan.md", `${source}\n\nParagraph 81.\n`);

  await expect(page.getByText("Paragraph 81.", { exact: true })).toBeAttached();
  expect(await documentScrollTop(page)).toBe(scrolledTo);
});

test("must keep Submit and its menu in full view when the comments outgrow their column", async ({ page, review }) => {
  await review.open("docs/plan.md");
  for (let count = 1; count <= 12; count++) {
    await page.getByRole("button", { name: "New comment" }).click();
    await page.getByRole("button", { name: "On the whole review" }).click();
    await page.keyboard.type(`Note ${count}`);
    await page.getByRole("button", { exact: true, name: "Save" }).click();
    await expect(page.getByRole("button", { exact: true, name: submitButtonName(count) })).toBeVisible();
  }

  const submit = page.getByRole("button", { exact: true, name: submitButtonName(12) });
  await expect(submit).toBeInViewport();

  await submit.click();

  await expect(page.getByRole("dialog", { name: "Submit review" })).toBeInViewport({ ratio: 1 });
});

test("must keep the header and the review bar to one line each when the window is very narrow", async ({
  page,
  review,
}) => {
  const longPath = "docs/a-very-long-document-name-for-checking-that-the-header-stays-on-one-line.md";
  await review.writeDocument(longPath, "# Long\n");
  await review.open(longPath);
  const headerHeight = await heightOf(page.getByRole("banner"));
  await page.setViewportSize(narrowWindow);
  const reviewBarHeight = await heightOf(page.getByRole("region", { name: "Review" }));

  await page.setViewportSize(phoneWindow);

  expect(await heightOf(page.getByRole("banner"))).toBe(headerHeight);
  expect(await heightOf(page.getByRole("region", { name: "Review" }))).toBe(reviewBarHeight);
});

test("must keep Comment in full view inside the doc column when the selected text reaches the column's right edge", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", `# Plan\n\nRetries ${"happen often ".repeat(40)}in the end.\n`);
  await review.open("docs/plan.md");

  await selectText(page, "Retries", "in the end.");

  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeInViewport({ ratio: 1 });
  expect(await page.getByRole("main").evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true);
});

test("must keep Comment in full view inside the doc column when the window narrows after the user selects text", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", `# Plan\n\nRetries ${"happen often ".repeat(40)}in the end.\n`);
  await review.open("docs/plan.md");
  await selectText(page, "Retries", "in the end.");
  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeVisible();

  await page.setViewportSize(phoneWindow);

  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeInViewport({ ratio: 1 });
  expect(await page.getByRole("main").evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true);
});

test("must lay a short doc out at the same reading width as a long one", async ({ page, review }) => {
  await page.setViewportSize(wideWindow);
  await review.writeDocument("docs/plan.md", "# Plan\n\nShort.\n");
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });
  await expect(article.getByText("Short.")).toBeVisible();
  const shortDocWidth = await widthOf(article);

  await review.writeDocument("docs/plan.md", `# Plan\n\nLong ${"words ".repeat(100)}end.\n`);

  await expect(article.getByText("Long words")).toBeVisible();
  expect(await widthOf(article)).toBe(shortDocWidth);
});

test("must hide the comments when the user presses Hide comments in a narrow window", async ({ page, review }) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  await commentsToggle(page).click();

  await page.getByRole("button", { name: "Hide comments" }).click();

  await expect(comments(page)).toBeHidden();
});

test("must move focus into the comments and back when the user opens and hides them from the keyboard in a narrow window", async ({
  page,
  review,
}) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  await commentsToggle(page).focus();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Hide comments" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(comments(page)).toBeHidden();
  await expect(commentsToggle(page)).toBeFocused();
});

test("must show the comments in a narrow window only when the user asks for them", async ({ page, review }) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  await expect(comments(page)).toBeHidden();
  await expect(page.getByRole("button", { exact: true, name: submitButtonName(0) })).toBeInViewport();

  await commentsToggle(page).click();
  await expect(comments(page)).toBeVisible();
  await commentsToggle(page).click();

  await expect(comments(page)).toBeHidden();
});

test("must open the comments at a new comment when the user starts one in a narrow window, and keep its text while they are hidden", async ({
  page,
  review,
}) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  const commentBox = page.getByRole("textbox", { exact: true, name: "Comment" });

  await selectText(page, "cache", "24h");
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await expect(commentBox).toBeFocused();
  await page.keyboard.type("Why 24h?");
  await commentsToggle(page).click();
  await expect(comments(page)).toBeHidden();
  await commentsToggle(page).click();

  await expect(commentBox).toHaveValue("Why 24h?");
  await page.getByRole("button", { exact: true, name: "Save" }).click();
  await expect(page.getByRole("button", { exact: true, name: submitButtonName(1) })).toBeInViewport();
});

test("must close the comments to show a thread's passage when the user clicks its location in a narrow window", async ({
  page,
  review,
}) => {
  await page.setViewportSize(narrowWindow);
  await review.writeDocument("docs/plan.md", withParagraphs(plan, 80));
  await review.open("docs/plan.md");
  await writeDraftComment(page, "Retries", "times.", "Make it configurable");
  await expect(comments(page)).toBeVisible();

  await page.getByRole("button", { name: "#1 Line 5" }).click();

  await expect(comments(page)).toBeHidden();
  await expect(page.getByRole("article", { name: "docs/plan.md" }).getByText("Retries happen")).toBeInViewport({
    ratio: 1,
  });
});

test("must keep the comments open when the window widens and narrows again", async ({ page, review }) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  await commentsToggle(page).click();

  await page.setViewportSize(wideWindow);
  await expect(commentsToggle(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Hide comments" })).toBeHidden();
  await expect(comments(page)).toBeVisible();
  await page.setViewportSize(narrowWindow);

  await expect(comments(page)).toBeVisible();
});

test("must show a thread's location below the comments header when the user selects it from the doc", async ({
  page,
  review,
}) => {
  await openPlanWithDrafts(page, review);
  await scrollCommentsToEnd(page);

  await page.getByRole("main").getByRole("button", { exact: true, name: "Thread #2" }).click();

  const location = page.getByRole("article", { name: "Thread #2" }).getByRole("button", { name: "#2 Line" });
  await expectBelowHeader(page, location);
  await expect(location).toBeInViewport({ ratio: 1 });
});

test("must show the whole composer below the comments header when the user starts a comment with the list scrolled", async ({
  page,
  review,
}) => {
  await openPlanWithDrafts(page, review);
  await scrollCommentsTo(page, 70);

  await startReviewComment(page);

  await expectBelowHeader(page, page.getByRole("region", { name: "New comment" }));
});

test("must show the whole composer below the comments header when the tabs show and the list is scrolled", async ({
  page,
  review,
}) => {
  await openPlanWithDrafts(page, review);
  await goToSpec(page);
  await page.getByRole("tab", { name: "All docs 8" }).click();
  await scrollCommentsTo(page, 70);

  await startReviewComment(page);

  await expectBelowHeader(page, page.getByRole("region", { name: "New comment" }));
});

test("must keep the tabs on their own row below the + Comment button", async ({ page, review }) => {
  await page.setViewportSize(wideWindow);
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await goToSpec(page);
  const tabs = comments(page).getByRole("tablist");
  const addComment = comments(page).getByRole("button", { name: "New comment" });
  await expect(tabs).toBeVisible();

  expect(await topOf(tabs)).toBeGreaterThanOrEqual(await bottomOf(addComment));

  await page.setViewportSize(narrowWindow);
  await page.reload();
  await commentsToggle(page).click();
  await expect(tabs).toBeVisible();

  expect(await topOf(tabs)).toBeGreaterThanOrEqual(await bottomOf(addComment));
});

test("must leave the prose gap above a code block and between two code blocks when they come in a row", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", "# Plan\n\nRun this:\n\n```\nplain code\n```\n\n    indented code\n");
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });

  const paragraphToFence = await gapBetween(
    article.locator('[data-md-block="1"]'),
    article.locator('[data-md-block="2"]')
  );
  const fenceToCode = await gapBetween(article.locator('[data-md-block="2"]'), article.locator('[data-md-block="3"]'));

  expect(paragraphToFence).toBeGreaterThanOrEqual(15);
  expect(fenceToCode).toBeGreaterThanOrEqual(15);
});

test("must frame a table row inside its table when the table is wider than the doc column", async ({
  page,
  review,
}) => {
  const cells = Array.from({ length: 12 }, (_, index) => `Configuration${index + 1}`);
  const row = (rowCells: string[]): string => `| ${rowCells.join(" | ")} |`;
  await review.writeDocument("docs/plan.md", [plan, row(cells), row(cells.map(() => "-")), row(cells)].join("\n"));
  await review.open("docs/plan.md");
  const table = page.getByRole("article", { name: "docs/plan.md" }).getByRole("table");
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  await table.getByRole("cell").first().hover();
  await page.getByRole("button", { name: "Comment on this block" }).hover();

  const frame = await boxOf(page.getByTestId("block-target"));
  const shown = await boxOf(table);
  expect(frame.x).toBeGreaterThanOrEqual(shown.x - 5);
  expect(frame.x + frame.width).toBeLessThanOrEqual(shown.x + shown.width + 5);
});

function documentScrollTop(page: Page): Promise<number> {
  return page.getByRole("main").evaluate((main) => main.scrollTop);
}

function comments(page: Page): Locator {
  return page.getByRole("complementary", { name: "Comments" });
}

function commentsToggle(page: Page): Locator {
  return page.getByRole("button", { exact: true, name: "Comments" });
}

async function heightOf(element: Locator): Promise<number | undefined> {
  return (await element.boundingBox())?.height;
}

async function widthOf(element: Locator): Promise<number | undefined> {
  return (await element.boundingBox())?.width;
}

async function openPlanWithDrafts(page: Page, review: ReviewFixture): Promise<void> {
  await page.setViewportSize(wideWindow);
  await review.writeDocument("docs/plan.md", withParagraphs(plan, 10));
  await review.open("docs/plan.md");
  for (let number = 1; number <= 8; number++) {
    const paragraph = `Paragraph ${number}.`;
    await writeDraftComment(page, paragraph, paragraph, `Note ${number}`);
    await expect(page.getByRole("article", { name: `Thread #${number}` })).toBeVisible();
  }
}

async function goToSpec(page: Page): Promise<void> {
  await page.getByRole("link", { name: "spec" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "docs/spec.md" })).toBeVisible();
}

async function startReviewComment(page: Page): Promise<void> {
  await page.getByRole("button", { name: "New comment" }).click();
  await page.getByRole("button", { name: "On the whole review" }).click();
  await expect(page.getByRole("textbox", { name: "Comment on the whole review" })).toBeFocused();
}

function scrollCommentsTo(page: Page, top: number): Promise<void> {
  return page.locator("#comments-panel").evaluate((panel, scrollTop) => panel.scrollTo(0, scrollTop), top);
}

function scrollCommentsToEnd(page: Page): Promise<void> {
  return page.locator("#comments-panel").evaluate((panel) => panel.scrollTo(0, panel.scrollHeight));
}

async function topOf(element: Locator): Promise<number> {
  return (await boxOf(element)).y;
}

async function bottomOf(element: Locator): Promise<number> {
  const { height, y } = await boxOf(element);
  return y + height;
}

async function expectBelowHeader(page: Page, element: Locator): Promise<void> {
  await expect
    .poll(async () => (await topOf(element)) - (await bottomOf(comments(page).locator("header"))))
    .toBeGreaterThanOrEqual(0);
}

async function boxOf(element: Locator): Promise<{ height: number; width: number; x: number; y: number }> {
  const box = await element.boundingBox();
  if (box === null) {
    throw new Error("The element is not on the page");
  }
  return box;
}

/**
 * @returns the space between the bottom of one block and the top of the block below it
 */
async function gapBetween(upper: Locator, lower: Locator): Promise<number> {
  const upperBox = await upper.boundingBox();
  const lowerBox = await lower.boundingBox();
  if (upperBox === null || lowerBox === null) {
    throw new Error("Both blocks must be on the page");
  }
  return lowerBox.y - (upperBox.y + upperBox.height);
}
