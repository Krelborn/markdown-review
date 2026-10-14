import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import type { ReviewFixture } from "./testing/reviewTest";
import {
  boxOf,
  highlightedText,
  saveNewComment,
  selectText,
  submitDrafts,
  test,
  withParagraphs,
  writeDraftComment,
} from "./testing/reviewTest";

test("must ask about the first comment's text, then save it and start the next, when the user starts another comment", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await selectText(page, "cache", "24h");
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await page.keyboard.type("Why 24h?");

  await selectText(page, "Retries", "times.");
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await expect(page.getByRole("alert")).toContainText("Save this comment first?");
  await page.getByRole("button", { exact: true, name: "Save" }).click();

  await expect(page.getByRole("region", { name: "Drafts" }).getByRole("article")).toHaveCount(1);
  const composer = page.getByRole("region", { name: "New comment" });
  await expect(composer.getByText("Retries happen three times.")).toBeVisible();
  await expect(composer.getByRole("textbox", { name: "Comment" })).toBeFocused();
});

test("must keep the passage highlighted while the user writes a comment on it", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await selectText(page, "cache", "24h");

  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await page.keyboard.type("Why 24h?");

  await expect.poll(() => highlightedText(page, "markdown-review-pending")).toEqual(["cache results for 24h"]);
});

test("must frame a block when the user points at the + beside it", async ({ page, review }) => {
  await review.open("docs/plan.md");

  await page.getByRole("article", { name: "docs/plan.md" }).getByText("Retries happen three times.").hover();
  await page.getByRole("button", { name: "Comment on this block" }).hover();

  await expect(page.getByTestId("block-target")).toBeVisible();
});

test("must frame each block in turn when the user moves the pointer down the gutter", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });
  const heading = article.getByRole("heading", { level: 1, name: "Plan" });
  const retries = article.getByText("Retries happen three times.");

  await page.getByTestId("block-gutter").hover({ position: await gutterBeside(page, heading) });
  await expect.poll(() => isFramed(page, heading)).toBe(true);
  await page.getByTestId("block-gutter").hover({ position: await gutterBeside(page, retries) });

  await expect.poll(() => isFramed(page, retries)).toBe(true);
});

test("must keep the gutter's bar hidden behind the + while the user presses it", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const retries = page.getByRole("article", { name: "docs/plan.md" }).getByText("Retries happen three times.");
  await page.getByTestId("block-gutter").hover({ position: await gutterBeside(page, retries) });
  const button = page.getByRole("button", { name: "Comment on this block" });

  await button.hover();
  await page.mouse.down();

  expect(await settledBackgroundAlpha(button)).toBe(255);
});

test("must start a comment on a block when the user clicks the gutter beside it", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const retries = page.getByRole("article", { name: "docs/plan.md" }).getByText("Retries happen three times.");

  await page.getByTestId("block-gutter").click({ position: await gutterBeside(page, retries) });

  await expect(
    page.getByRole("region", { name: "New comment" }).getByText("Retries happen three times.")
  ).toBeVisible();
});

test("must start a comment quoting the rows the user drags over in the gutter", async ({ page, review }) => {
  const rows = await openTableDocument(page, review);

  await dragDownRows(page, rows);
  await page.mouse.up();

  await expect(newCommentQuote(page)).toContainText("ttl");
  await expect(newCommentQuote(page)).toContainText("backoff");
  await expect(newCommentQuote(page)).not.toContainText("Setting");
  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeHidden();
});

test("must scroll the doc column, and take in the blocks it brings into view, when the user drags to the column's bottom edge", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", withParagraphs("# Plan", 60));
  await review.open("docs/plan.md");
  const column = page.getByRole("main");
  const columnBox = await boxOf(column);
  const from = await pointInGutterBeside(
    page,
    page.getByRole("article", { name: "docs/plan.md" }).getByText("Paragraph 1.", { exact: true })
  );

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x, columnBox.y + columnBox.height - 4, { steps: 5 });
  await expect.poll(() => column.evaluate((main) => main.scrollTop)).toBeGreaterThan(600);
  await page.mouse.up();

  await expect(newCommentQuote(page)).toContainText("Paragraph 1.");
  await expect(newCommentQuote(page)).toContainText("Paragraph 20.");
});

test("must clear the selected text, and Comment beside it, when the user starts a drag down the gutter", async ({
  page,
  review,
}) => {
  const rows = await openTableDocument(page, review);
  await selectText(page, "After", "table.");
  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeVisible();

  await dragDownRows(page, rows);

  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeHidden();
  expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
  await page.mouse.up();
});

test("must start a comment quoting the whole table when the user clicks the bracket beside it", async ({
  page,
  review,
}) => {
  const rows = await openTableDocument(page, review);
  const lane = await boxOf(page.getByTestId("bracket-lane"));
  const beside = await pointInGutterBeside(page, rows.nth(1));

  await page.mouse.move(lane.x + lane.width / 2, beside.y);
  await expect(page.getByTestId("block-target")).toContainText("Comment on the table");
  await page.mouse.down();
  await page.mouse.up();

  await expectWholeTableQuoted(page);
});

test("must start a comment quoting the whole table when the user ⌥-clicks the gutter beside a row", async ({
  page,
  review,
}) => {
  const rows = await openTableDocument(page, review);
  const beside = await pointInGutterBeside(page, rows.nth(1));

  await page.mouse.move(beside.x, beside.y);
  await page.keyboard.down("Alt");
  await expect(page.getByTestId("block-target")).toContainText("Comment on the table");
  await page.mouse.down();
  await page.mouse.up();
  await page.keyboard.up("Alt");

  await expectWholeTableQuoted(page);
});

test("must show a bar, and no highlight, beside a saved comment on a section", async ({ page, review }) => {
  await openSectionsDocument(review);

  await writeSectionComment(page, "Goals", "Rethink these goals.");

  await expect(page.getByTestId("thread-bar")).toBeVisible();
  await expect.poll(() => highlightedText(page)).toEqual([]);
});

test("must frame the section when the user points at the card of a comment on it", async ({ page, review }) => {
  await openSectionsDocument(review);
  await writeSectionComment(page, "Goals", "Rethink these goals.");

  await page.getByRole("region", { name: "Drafts" }).getByRole("article").hover();

  const article = page.getByRole("article", { name: "docs/plan.md" });
  await expect.poll(() => isFramed(page, article.getByText("Second goal."))).toBe(true);
  await expect.poll(() => isFramed(page, article.getByText("None yet."))).toBe(false);
});

test("must put the + beside a list item when the user points beside the item's text", async ({ page, review }) => {
  await review.writeDocument("docs/plan.md", "# Plan\n\n- First item\n- Second item\n");
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });
  await article.getByText("First item").hover();
  const second = await article.getByText("Second item").boundingBox();
  if (second === null) {
    throw new Error("The list item is not on the page");
  }

  await page.mouse.move(second.x + second.width + 200, second.y + second.height / 2);
  await page.getByRole("button", { name: "Comment on this block" }).click();

  await expect(page.getByRole("region", { name: "New comment" }).getByText("Second item")).toBeVisible();
});

test("must emphasise a comment's passage while the user points at its card", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");

  await page.getByRole("article", { name: "Thread #1" }).hover();

  await expect.poll(() => highlightedText(page, "markdown-review-hovered")).toEqual(["cache results for 24h"]);
});

test("must underline a comment's location in the text's colour while the user points at its marker", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");

  await page.getByRole("main").getByRole("button", { exact: true, name: "Thread #1" }).hover();

  await expect.poll(() => isUnderlinedInTextColour(page.getByRole("button", { name: "#1 Line 3" }))).toBe(true);
});

test("must underline a comment's location in the text's colour while the user points at its passage", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");

  await page.getByRole("article", { name: "docs/plan.md" }).getByText("24h", { exact: true }).hover();

  await expect.poll(() => isUnderlinedInTextColour(page.getByRole("button", { name: "#1 Line 3" }))).toBe(true);
});

test("must leave a comment's location as it is while the user points at its card", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");

  await page.getByRole("article", { name: "Thread #1" }).getByText("Why 24h?").hover();

  await expect.poll(() => highlightedText(page, "markdown-review-hovered")).toEqual(["cache results for 24h"]);
  expect(await isUnderlinedInTextColour(page.getByRole("button", { name: "#1 Line 3" }))).toBe(false);
});

test("must keep a half-written reply when the user goes to another doc and back", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await submitDrafts(page, 1, "Revise");
  await page.getByRole("article", { name: "Thread #1" }).getByRole("button", { name: "Reply" }).click();
  await page.keyboard.type("Half written");

  await page.getByRole("link", { name: "spec" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "spec.md" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  await page.goBack();

  await expect(page.getByRole("heading", { level: 1, name: "plan.md" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
});

test("must close a draft reply's editor when the user discards the draft", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await submitDrafts(page, 1, "Revise");
  const thread = page.getByRole("article", { name: "Thread #1" });
  await thread.getByRole("button", { name: "Reply" }).click();
  await page.keyboard.type("Hourly");
  await thread.getByRole("button", { name: "Save" }).click();
  await thread.getByRole("button", { name: "Edit" }).click();

  await thread.getByRole("button", { name: "Discard" }).click();
  await page.getByRole("dialog", { name: "Discard this reply?" }).getByRole("button", { name: "Discard" }).click();

  await expect(thread.getByRole("textbox")).toHaveCount(0);
  await expect(thread.getByRole("button", { name: "Reply" })).toBeVisible();
});

test("must discard a draft from its card without opening the editor when the user confirms", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const thread = page.getByRole("article", { name: "Thread #1" });

  await thread.getByRole("button", { name: "Discard" }).click();
  await page.getByRole("dialog", { name: "Discard this comment?" }).getByRole("button", { name: "Discard" }).click();

  await expect(thread).toHaveCount(0);
});

test("must move focus to the next card's location when the user discards a draft comment", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await writeDraftComment(page, "Retries", "times.", "Why three?");

  await page.getByRole("article", { name: "Thread #1" }).getByRole("button", { name: "Discard" }).click();
  await page.getByRole("dialog", { name: "Discard this comment?" }).getByRole("button", { name: "Discard" }).click();

  await expect(page.getByRole("article", { name: "Thread #1" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "#2 Line 5" })).toBeFocused();
});

for (const { action, close } of [
  { action: "presses Escape", close: (page: Page) => page.keyboard.press("Escape") },
  {
    action: "clicks Cancel",
    close: (page: Page) =>
      page.getByRole("dialog", { name: "Discard this comment?" }).getByRole("button", { name: "Cancel" }).click(),
  },
]) {
  test(`must keep the draft and return focus to Discard when the user ${action} in the confirmation`, async ({
    page,
    review,
  }) => {
    await review.open("docs/plan.md");
    await writeDraftComment(page, "cache", "24h", "Why 24h?");
    const thread = page.getByRole("article", { name: "Thread #1" });
    const confirmation = page.getByRole("dialog", { name: "Discard this comment?" });
    await thread.getByRole("button", { name: "Discard" }).click();
    await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeFocused();

    await close(page);

    await expect(confirmation).toBeHidden();
    await expect(thread.getByRole("button", { name: "Discard" })).toBeFocused();
    await expect(thread.getByText("Why 24h?")).toBeVisible();
  });
}

test("must keep the editor open and return focus to Discard when the user presses Escape in its confirmation", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const thread = page.getByRole("article", { name: "Thread #1" });
  const confirmation = page.getByRole("dialog", { name: "Discard this comment?" });
  await thread.getByRole("button", { name: "Edit" }).click();
  await thread.getByRole("button", { name: "Discard" }).click();
  await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeFocused();

  await page.keyboard.press("Escape");

  await expect(confirmation).toBeHidden();
  await expect(thread.getByRole("textbox", { name: "Draft comment" })).toHaveValue("Why 24h?");
  await expect(thread.getByRole("button", { name: "Discard" })).toBeFocused();
});

test("must leave focus off Discard when the user closes the confirmation by clicking outside it", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const discard = page.getByRole("article", { name: "Thread #1" }).getByRole("button", { name: "Discard" });
  const confirmation = page.getByRole("dialog", { name: "Discard this comment?" });
  await discard.click();
  await expect(confirmation.getByRole("button", { name: "Cancel" })).toBeFocused();

  await page.getByRole("article", { name: "docs/plan.md" }).getByText("Retries happen three times.").click();

  await expect(confirmation).toBeHidden();
  await expect(discard).not.toBeFocused();
});

test("must open the confirmation inside the comments, from Discard's start edge", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const discard = page.getByRole("article", { name: "Thread #1" }).getByRole("button", { name: "Discard" });
  const button = await boxOf(discard);

  await discard.click();

  const confirmation = await boxOf(page.getByRole("dialog", { name: "Discard this comment?" }));
  const comments = await boxOf(page.getByRole("complementary", { name: "Comments" }));
  expect(confirmation.x).toBeCloseTo(button.x, 0);
  expect(confirmation.x + confirmation.width).toBeLessThanOrEqual(comments.x + comments.width);
});

test("must open the confirmation again when the user presses Discard after closing it with Escape", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const discard = page.getByRole("article", { name: "Thread #1" }).getByRole("button", { name: "Discard" });
  const confirmation = page.getByRole("dialog", { name: "Discard this comment?" });
  await discard.click();
  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();

  await discard.click();

  await expect(confirmation).toBeVisible();
});

test("must give the editor the read-only text's font size and line height when the user edits a draft", async ({
  page,
  review,
}) => {
  const thread = await writeDraftToEdit(page, review, "Why 24h?");
  const readOnly = await fontOf(thread.getByText("Why 24h?"));

  await thread.getByRole("button", { name: "Edit" }).click();

  expect(await fontOf(thread.getByRole("textbox", { name: "Draft comment" }))).toEqual(readOnly);
});

test("must show all of a five-line draft without scrolling when the user edits it", async ({ page, review }) => {
  const thread = await writeDraftToEdit(page, review, "One\nTwo\nThree\nFour\nFive");

  await thread.getByRole("button", { name: "Edit" }).click();

  expect(await overflowOf(thread.getByRole("textbox", { name: "Draft comment" }))).toBe(0);
});

test("must scroll the editor when the draft is taller than half the window", async ({ page, review }) => {
  const thread = await writeDraftToEdit(page, review, Array.from({ length: 40 }, (_, i) => `Line ${i + 1}`).join("\n"));

  await thread.getByRole("button", { name: "Edit" }).click();

  const textbox = thread.getByRole("textbox", { name: "Draft comment" });
  expect((await boxOf(textbox)).height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 0) / 2);
  expect(await overflowOf(textbox)).toBeGreaterThan(0);
});

test("must centre each avatar on its name line when a thread has messages and a draft reply", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await submitDrafts(page, 1, "Revise");
  await review.run(["reply", "1", "The upstream data changes daily."]);
  const thread = page.getByRole("article", { name: "Thread #1" });
  await thread.getByRole("button", { name: "Reply" }).click();
  await page.keyboard.type("Hourly, then.");

  await thread.getByRole("button", { name: "Save" }).click();

  await expect(thread.getByText("Hourly, then.")).toBeVisible();
  expect(await avatarOffset(thread, "Y", "You", 0)).toBeCloseTo(0, 0);
  expect(await avatarOffset(thread, "A", "Agent", 0)).toBeCloseTo(0, 0);
  expect(await avatarOffset(thread, "Y", "You", 1)).toBeCloseTo(0, 0);
});

/**
 * @returns how far, in pixels, the centre of a message's avatar sits below the centre of its name line
 * @param initial the initial the avatar shows
 * @param name the name beside it
 * @param index which of the messages with that name, from the first
 */
async function avatarOffset(thread: Locator, initial: string, name: string, index: number): Promise<number> {
  const avatar = await boxOf(thread.getByText(initial, { exact: true }).nth(index));
  const nameLine = await boxOf(thread.getByText(name, { exact: true }).nth(index).locator(".."));
  return avatar.y + avatar.height / 2 - (nameLine.y + nameLine.height / 2);
}

/**
 * Opens the plan and saves a draft comment on its first passage
 *
 * @returns the draft's card
 */
async function writeDraftToEdit(page: Page, review: ReviewFixture, body: string): Promise<Locator> {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", body);
  return page.getByRole("article", { name: "Thread #1" });
}

/**
 * @returns the element's computed font size and line height
 */
function fontOf(element: Locator): Promise<{ fontSize: string; lineHeight: string }> {
  return element.evaluate((node) => {
    const { fontSize, lineHeight } = getComputedStyle(node);
    return { fontSize, lineHeight };
  });
}

/**
 * @returns how far, in pixels, the element's content runs past its visible height
 */
function overflowOf(element: Locator): Promise<number> {
  return element.evaluate((node) => node.scrollHeight - node.clientHeight);
}

/**
 * @returns the point in the gutter, relative to it, just left of the prose and clear of the + and the bracket lane, that
 *   is level with the middle of the element
 */
async function gutterBeside(page: Page, element: Locator): Promise<{ x: number; y: number }> {
  const gutter = await boxOf(page.getByTestId("block-gutter"));
  const point = await pointInGutterBeside(page, element);
  return { x: point.x - gutter.x, y: point.y - gutter.y };
}

/**
 * Opens a doc holding a heading, a table of three rows under a header row, and a paragraph
 *
 * @returns the table's rows, the header row first
 */
async function openTableDocument(page: Page, review: ReviewFixture): Promise<Locator> {
  await review.writeDocument(
    "docs/plan.md",
    "# Plan\n\n| Setting | Value |\n| --- | --- |\n| ttl | 24h |\n| retries | 3 |\n| backoff | 2s |\n\nAfter the table.\n"
  );
  await review.open("docs/plan.md");
  return page.getByRole("article", { name: "docs/plan.md" }).getByRole("row");
}

function newCommentQuote(page: Page): Locator {
  return page.getByRole("region", { name: "New comment" }).getByRole("blockquote");
}

/**
 * Expects the new comment to quote every row of the table `openTableDocument` opens, and nothing after it
 */
async function expectWholeTableQuoted(page: Page): Promise<void> {
  await expect(newCommentQuote(page)).toContainText("Setting");
  await expect(newCommentQuote(page)).toContainText("backoff");
  await expect(newCommentQuote(page)).not.toContainText("After the table.");
}

/**
 * Presses the main button in the gutter beside the first row under the header of the table `openTableDocument` opens,
 * and moves down to the third without letting go
 *
 * @param rows the table's rows, the header row first
 */
async function dragDownRows(page: Page, rows: Locator): Promise<void> {
  const from = await pointInGutterBeside(page, rows.nth(1));
  const to = await pointInGutterBeside(page, rows.nth(3));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 5 });
}

/**
 * Opens a doc of three sections: a title over an intro, and two headings over their paragraphs
 */
async function openSectionsDocument(review: ReviewFixture): Promise<void> {
  await review.writeDocument(
    "docs/plan.md",
    "# Plan\n\nIntro.\n\n## Goals\n\nRetries happen three times.\n\nSecond goal.\n\n## Risks\n\nNone yet.\n"
  );
  await review.open("docs/plan.md");
}

/**
 * Comments on the section under a heading from the bracket beside it, and saves the comment as a draft
 */
async function writeSectionComment(page: Page, heading: string, body: string): Promise<void> {
  const lane = await boxOf(page.getByTestId("bracket-lane"));
  const beside = await pointInGutterBeside(
    page,
    page.getByRole("article", { name: "docs/plan.md" }).getByRole("heading", { name: heading })
  );
  await page.mouse.move(lane.x + lane.width / 2, beside.y);
  await page.mouse.down();
  await page.mouse.up();
  await saveNewComment(page, body);
}

/**
 * @returns the point on the page in the gutter, just left of the prose and clear of the +, that is level with the middle
 *   of the element
 */
async function pointInGutterBeside(page: Page, element: Locator): Promise<{ x: number; y: number }> {
  const gutter = await boxOf(page.getByTestId("block-gutter"));
  const box = await boxOf(element);
  return { x: gutter.x + gutter.width - 6, y: box.y + box.height / 2 };
}

/**
 * @returns the alpha, from 0 to 255, of the element's background colour once its transitions end, which a canvas
 *   resolves from whatever colour syntax the browser computes it in
 */
function settledBackgroundAlpha(element: Locator): Promise<number | undefined> {
  return element.evaluate(async (node) => {
    await Promise.all(node.getAnimations().map((animation) => animation.finished));
    const context = document.createElement("canvas").getContext("2d");
    if (context === null) {
      return undefined;
    }
    context.fillStyle = getComputedStyle(node).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    return context.getImageData(0, 0, 1, 1).data[3];
  });
}

/**
 * @returns whether the frame around the block a comment would be on surrounds the element
 */
async function isFramed(page: Page, element: Locator): Promise<boolean> {
  const frame = await page.getByTestId("block-target").boundingBox();
  const box = await element.boundingBox();
  return frame !== null && box !== null && frame.y <= box.y && frame.y + frame.height >= box.y + box.height;
}

/**
 * @returns whether the element's underline is drawn in its text's colour, as a comment's location is while pointed at
 */
function isUnderlinedInTextColour(element: Locator): Promise<boolean> {
  return element.evaluate((node) => {
    const { color, textDecorationColor } = getComputedStyle(node);
    return textDecorationColor === color;
  });
}
