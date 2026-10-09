import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { plan, scrollDocumentToEnd, selectText, test, withParagraphs, writeDraftComment } from "./testing/reviewTest";

const narrowWindow = { height: 800, width: 700 };

const wideWindow = { height: 720, width: 1280 };

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
  await expect(page.getByRole("button", { name: "Submit (0)" })).toBeInViewport();
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
    await page.getByRole("textbox", { name: "Comment on the whole review" }).fill(`Note ${count}`);
    await page.getByRole("button", { name: "Add comment" }).click();
    await expect(page.getByRole("button", { exact: true, name: `Submit (${count})` })).toBeVisible();
  }

  const submit = page.getByRole("button", { exact: true, name: "Submit (12)" });
  await expect(submit).toBeInViewport();

  await submit.click();

  await expect(page.getByRole("dialog", { name: "Submit review" })).toBeInViewport({ ratio: 1 });
});

test("must show the comments in a narrow window only when the user asks for them", async ({ page, review }) => {
  await page.setViewportSize(narrowWindow);
  await review.open("docs/plan.md");
  await expect(comments(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Submit (0)" })).toBeInViewport();

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
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("button", { name: "Submit (1)" })).toBeInViewport();
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
  await expect(comments(page)).toBeVisible();
  await page.setViewportSize(narrowWindow);

  await expect(comments(page)).toBeVisible();
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
