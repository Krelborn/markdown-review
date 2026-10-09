import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { plan, scrollDocumentToEnd, test, withParagraphs } from "./testing/reviewTest";

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

function documentScrollTop(page: Page): Promise<number> {
  return page.getByRole("main").evaluate((main) => main.scrollTop);
}
