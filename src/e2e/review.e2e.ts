import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  highlightedText,
  plan,
  scrollDocumentToEnd,
  submitDrafts,
  test,
  withParagraphs,
  writeDraftComment,
} from "./testing/reviewTest";

test("must hand the user's comment to the agent's waiting poll when the user submits it", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const poll = await review.startPoll();

  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await submitDrafts(page, 1, "Request changes");

  const { exitCode, stdout } = await poll.result;
  expect(exitCode).toBe(0);
  expect(stdout).toContain('#1 docs/plan.md:3\n  quote: "cache results for 24h"\n  user: Why 24h?');
});

test("must keep the highlight on the commented text when the agent edits the doc above it", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");

  await review.writeDocument("docs/plan.md", plan.replace("# Plan\n", "# Plan\n\nAn introduction the agent added.\n"));

  await expect(page.getByRole("button", { name: "#1 Line 5" })).toBeVisible();
  await expect(page.getByText("An introduction the agent added.")).toBeVisible();
  expect(await highlightedText(page)).toEqual(["cache results for 24h"]);
});

test("must move the thread to Resolved and show the agent's note when the agent resolves it", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "Retries", "times.", "Make it configurable");
  await submitDrafts(page, 1, "Request changes");
  await expect(page.getByRole("region", { name: "Open" })).toBeVisible();

  await review.run(["resolve", "1", "Added a retries setting"]);

  const resolved = page.getByRole("region", { name: "Resolved" });
  await resolved.getByRole("heading", { name: "Resolved 1" }).click();
  await expect(resolved.getByRole("article", { name: "Thread #1" })).toContainText("Added a retries setting");
  await expect(page.getByRole("region", { name: "Open" })).toBeHidden();
});

test("must end the agent's poll when the user approves the review", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const poll = await review.startPoll();

  await submitDrafts(page, 0, "Approve");

  const { stdout } = await poll.result;
  expect(stdout.startsWith("Review approved. No threads need you.\n")).toBe(true);
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
});

test("must open the linked doc without reloading the page when the user follows a relative link", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await page.evaluate(() => Object.assign(window, { loadedBeforeTheLink: true }));

  await page.getByRole("link", { name: "spec" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "spec.md" })).toBeVisible();
  expect(await page.evaluate(() => "loadedBeforeTheLink" in window)).toBe(true);
  await expect(page).toHaveURL((url) => url.pathname + url.hash === "/document/docs/spec.md#goals");
  await expect(page.getByRole("heading", { level: 2, name: "Goals" })).toBeInViewport();
});

test("must scroll the selected thread's passage back into view each time the user clicks its location, even from under the header", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", withParagraphs(plan, 80));
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  const passage = page.getByRole("article", { name: "docs/plan.md" }).getByText("We cache results");
  const location = page.getByRole("button", { name: "#1 Line 3" });

  await scrollDocumentToEnd(page);
  await location.click();
  await expect(passage).toBeInViewport();

  await scrollDocumentToEnd(page);
  await expect(passage).not.toBeInViewport();
  await location.click();
  await expect(passage).toBeInViewport({ ratio: 1 });

  await scrollJustPast(passage);
  await expect(passage).not.toBeInViewport({ ratio: 1 });
  await location.click();

  await expect(passage).toBeInViewport({ ratio: 1 });
});

/**
 * Scrolls the doc column until the element's top edge sits just above the column's, under the header
 */
function scrollJustPast(element: Locator): Promise<void> {
  return element.evaluate((target) => {
    const column = target.closest("main");
    if (column === null) {
      throw new Error("The element is not in the doc column");
    }
    column.scrollTop += target.getBoundingClientRect().top - column.getBoundingClientRect().top + 8;
  });
}
