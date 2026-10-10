import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { highlightedText, selectText, submitDrafts, test, writeDraftComment } from "./testing/reviewTest";

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

test("must start a comment on a block when the user clicks the gutter beside it", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const retries = page.getByRole("article", { name: "docs/plan.md" }).getByText("Retries happen three times.");

  await page.getByTestId("block-gutter").click({ position: await gutterBeside(page, retries) });

  await expect(
    page.getByRole("region", { name: "New comment" }).getByText("Retries happen three times.")
  ).toBeVisible();
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

test("must give a comment's card the hovered style when the user points at its passage", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const card = page.getByRole("article", { name: "Thread #1" });
  const article = page.getByRole("article", { name: "docs/plan.md" });
  const hoveredBackground = await subtleSecondaryBackground(page);
  await article.getByText("Retries happen three times.").hover();
  await expect.poll(() => backgroundOf(card)).not.toBe(hoveredBackground);

  await article.getByText("24h", { exact: true }).hover();

  await expect.poll(() => backgroundOf(card)).toBe(hoveredBackground);
});

test("must keep a half-written reply when the user goes to another doc and back", async ({ page, review }) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await submitDrafts(page, 1, "Request changes");
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
  await submitDrafts(page, 1, "Request changes");
  const thread = page.getByRole("article", { name: "Thread #1" });
  await thread.getByRole("button", { name: "Reply" }).click();
  await page.keyboard.type("Hourly");
  await thread.getByRole("button", { name: "Save" }).click();
  await thread.getByRole("button", { name: "Edit" }).click();

  await thread.getByRole("button", { name: "Discard" }).click();

  await expect(thread.getByRole("textbox")).toHaveCount(0);
  await expect(thread.getByRole("button", { name: "Reply" })).toBeVisible();
});

/**
 * @returns the point in the gutter, near its left edge and clear of the +, that is level with the middle of the element
 */
async function gutterBeside(page: Page, element: Locator): Promise<{ x: number; y: number }> {
  const gutter = await page.getByTestId("block-gutter").boundingBox();
  const box = await element.boundingBox();
  if (gutter === null || box === null) {
    throw new Error("The gutter and the element must be on the page");
  }
  return { x: 2, y: box.y + box.height / 2 - gutter.y };
}

/**
 * @returns whether the frame around the block a comment would be on surrounds the element
 */
async function isFramed(page: Page, element: Locator): Promise<boolean> {
  const frame = await page.getByTestId("block-target").boundingBox();
  const box = await element.boundingBox();
  return frame !== null && box !== null && frame.y <= box.y && frame.y + frame.height >= box.y + box.height;
}

function backgroundOf(element: Locator): Promise<string> {
  return element.evaluate((node) => getComputedStyle(node).backgroundColor);
}

/**
 * @returns the colour a card shows as its background while its thread is hovered
 */
function subtleSecondaryBackground(page: Page): Promise<string> {
  return page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = "var(--sui-color-secondary-subtle)";
    document.body.append(probe);
    const { backgroundColor } = getComputedStyle(probe);
    probe.remove();
    return backgroundColor;
  });
}
