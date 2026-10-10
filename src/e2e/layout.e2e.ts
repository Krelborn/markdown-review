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

const largeWindow = { height: 1080, width: 1920 };

/**
 * How far a wide block may reach past the prose, as a share of the prose's width: 28ch beyond 72ch
 */
const wideRoomShare = 28 / 72;

/**
 * A line of code far longer than the room beside the prose
 */
const longCodeLine = `const retryDelays = [${Array.from({ length: 30 }, (_, index) => (index + 1) * 100).join(", ")}];`;

/**
 * A doc whose only wide block is one long line of code, so the doc keeps its size when only the window's width changes
 */
const longCodeLineDoc = ["# Plan", "", "```ts", longCodeLine, "```", ""].join("\n");

/**
 * A doc whose first table, second code block and first diagram need more room than the prose has, and whose other
 * blocks fit it
 */
const wideBlocksDoc = [
  "# Plan",
  "",
  `Prose ${"runs on ".repeat(40)}to the end.`,
  "",
  "| Topic | Choice | Why | Owner |",
  "| --- | --- | --- | --- |",
  `| Retries | Three times | ${"The network drops a request now and then. ".repeat(4)}| Platform team |`,
  "",
  "| Key | Value |",
  "| --- | --- |",
  "| ttl | 24h |",
  "",
  "```ts",
  "const ttl = 24;",
  "```",
  "",
  "```ts",
  longCodeLine,
  "```",
  "",
  "```mermaid",
  "flowchart LR",
  "  A[Agent writes the plan] --> B[Agent opens it for review] --> C[User reviews it in the browser]",
  "  C --> D[User submits comments] --> E[Agent edits the plan] --> F[Agent replies and resolves]",
  "```",
  "",
  "```mermaid",
  "flowchart TD",
  "  A --> B",
  "```",
  "",
].join("\n");

test("must keep the header and Submit in view, and the window still, when the user scrolls to the end of a long doc", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", withParagraphs(plan, 80));
  await review.open("docs/plan.md");

  await scrollDocumentToEnd(page);

  await expect(page.getByText("Paragraph 80.", { exact: true })).toBeInViewport();
  await expect(page.getByRole("heading", { level: 1, name: "plan.md" })).toBeInViewport();
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

  await expect(page.getByRole("heading", { level: 1, name: "spec.md" })).toBeVisible();
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
  const table = await openPlanWithScrollingTable(page, review);

  await table.getByRole("cell").first().hover();
  await page.getByRole("button", { name: "Comment on this block" }).hover();

  const frame = await boxOf(page.getByTestId("block-target"));
  const shown = await boxOf(table);
  expect(frame.x).toBeGreaterThanOrEqual(shown.x - 5);
  expect(frame.x + frame.width).toBeLessThanOrEqual(shown.x + shown.width + 5);
});

test("must start each table at the prose's left edge, and let only a wide one reach 28ch past it, when the window is large", async ({
  page,
  review,
}) => {
  const article = await openWideBlocksDoc(page, review);

  const prose = await boxOf(article);
  const wide = await boxOf(article.getByRole("table").first());
  const fitting = await boxOf(article.getByRole("table").last());

  expectToFillTheRoom(wide, prose);
  expect(fitting.x).toBeCloseTo(prose.x, 0);
  expect(fitting.width).toBeLessThan(prose.width / 2);
});

for (const { size, width } of [
  { size: largeWindow, width: "large" },
  { size: wideWindow, width: "wide" },
  { size: narrowWindow, width: "narrow" },
]) {
  test(`must never scroll the doc column sideways when the doc has wide blocks and the window is ${width}`, async ({
    page,
    review,
  }) => {
    const article = await openWideBlocksDoc(page, review, { size });
    await expect(article.locator("[data-mermaid-definition] > svg")).toHaveCount(2);

    expect(await page.getByRole("main").evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true);
  });
}

test("must keep a short code block as wide as the prose and scroll a long one sideways without wrapping when the window is large", async ({
  page,
  review,
}) => {
  const article = await openWideBlocksDoc(page, review);
  const shortCode = article.locator("pre", { hasText: "const ttl" });
  const longCode = article.locator("pre", { hasText: "retryDelays" });

  const prose = await boxOf(article);
  const short = await boxOf(shortCode);
  const long = await boxOf(longCode);

  expect(short.x).toBeCloseTo(prose.x, 0);
  expect(short.width).toBeCloseTo(prose.width, 0);
  expectToFillTheRoom(long, prose);
  expect(await longCode.evaluate((pre) => pre.scrollWidth > pre.clientWidth)).toBe(true);
  expect(await linesIn(longCode)).toBe(1);
});

test("must let the keyboard reach a code block that is too wide for its room, and ring it as a focused table is ringed", async ({
  page,
  review,
}) => {
  const article = await openWideBlocksDoc(page, review);
  const longCode = article.locator("pre", { hasText: "retryDelays" });
  await article.locator("pre", { hasText: "const ttl" }).focus();

  await page.keyboard.press("Tab");

  await expect(longCode).toBeFocused();
  expect(
    await longCode.evaluate((pre) => [getComputedStyle(pre).outlineStyle, getComputedStyle(pre).outlineOffset])
  ).toEqual(["solid", "2px"]);
});

test("must keep a wide code block inside the alert it is in when the window is large", async ({ page, review }) => {
  const article = await openWideBlocksDoc(page, review, {
    source: ["# Plan", "", "> [!NOTE]", "> Run this:", ">", "> ```ts", `> ${longCodeLine}`, "> ```", ""].join("\n"),
  });

  const alert = await boxOf(article.locator(".markdown-alert"));
  const code = await boxOf(article.locator("pre"));

  expect(code.x + code.width).toBeLessThanOrEqual(alert.x + alert.width);
});

test("must draw a wide diagram past the prose and keep a narrow one centred in it when the window is large", async ({
  page,
  review,
}) => {
  const article = await openWideBlocksDoc(page, review);
  const diagrams = article.locator("[data-mermaid-definition] > svg");
  await expect(diagrams).toHaveCount(2);

  const prose = await boxOf(article);
  const wide = await boxOf(diagrams.first());
  const narrow = await boxOf(diagrams.last());

  expectToFillTheRoom(wide, prose);
  expect(narrow.width).toBeLessThan(prose.width / 2);
  expect(narrow.x + narrow.width / 2).toBeCloseTo(prose.x + prose.width / 2, 0);
});

test("must space the prose's lines at 1.6 and code's at 1.5", async ({ page, review }) => {
  const article = await openWideBlocksDoc(page, review, { size: wideWindow });
  const lineHeightOf = (element: Locator): Promise<string> =>
    element.evaluate((shown) => getComputedStyle(shown).lineHeight);

  expect(await lineHeightOf(article.getByText("Prose runs on"))).toBe("25.6px");
  expect(await lineHeightOf(article.getByRole("cell", { name: "Platform team" }))).toBe("25.6px");
  expect(await lineHeightOf(article.locator("pre", { hasText: "const ttl" }))).toBe("21px");
});

test("must wrap a pre that is not a code block, with no tab stop, and space it as the text around it when it is wider than the prose", async ({
  page,
  review,
}) => {
  const longText = `${"Wraps at the edge of its box. ".repeat(10)}End.`;
  const article = await openWideBlocksDoc(page, review, {
    source: [
      "---",
      "owner:",
      `  notes: ${longText}`,
      "---",
      "",
      `Run <pre>${longText}</pre> now.`,
      "",
      `## Steps <pre>${longText}</pre>`,
      "",
      `- Then <pre>${longText}</pre>`,
      "",
    ].join("\n"),
  });
  const pres = article.locator("pre");
  await expect(pres).toHaveCount(4);

  for (const pre of await pres.all()) {
    expect(await pre.evaluate((shown) => shown.tabIndex)).toBe(-1);
    expect(await linesIn(pre)).toBeGreaterThan(1);
    expect(await pre.evaluate((shown) => shown.scrollWidth <= shown.clientWidth)).toBe(true);
    expect(await lineHeightRatio(pre)).toBeCloseTo(await lineHeightRatio(pre.locator("xpath=..")));
  }
});

test("must put a thread's marker just right of the wide table its passage is in when the window is large", async ({
  page,
  review,
}) => {
  const article = await openWideBlocksDoc(page, review);

  await writeDraftComment(page, "The network drops", "now and then.", "How often?");

  const marker = await boxOf(page.getByRole("main").getByRole("button", { exact: true, name: "Thread #1" }));
  const table = await boxOf(article.getByRole("table").first());
  const column = await boxOf(page.getByRole("main"));
  expect(marker.x).toBeGreaterThanOrEqual(table.x + table.width);
  expect(marker.x + marker.width).toBeLessThanOrEqual(column.x + column.width);
});

for (const { from, through, where } of [
  { from: "Prose runs on", through: "to the end.", where: "in the prose" },
  { from: "24h", through: "24h", where: "in a table narrower than the prose" },
]) {
  test(`must keep the marker of a thread ${where} beside the prose when the doc also has a wide table`, async ({
    page,
    review,
  }) => {
    const article = await openWideBlocksDoc(page, review);

    await writeDraftComment(page, from, through, "Why?");

    const marker = await boxOf(page.getByRole("main").getByRole("button", { exact: true, name: "Thread #1" }));
    const prose = await boxOf(article);
    const markerLane = 40;
    expect(marker.x).toBeGreaterThanOrEqual(prose.x + prose.width);
    expect(marker.x + marker.width).toBeLessThanOrEqual(prose.x + prose.width + markerLane);
  });
}

test("must keep a thread's marker just right of a wide block when only the window's width changes", async ({
  page,
  review,
}) => {
  const article = await openWideBlocksDoc(page, review, { source: longCodeLineDoc });
  await writeDraftComment(page, "retryDelays", "retryDelays", "Too long?");

  await page.setViewportSize({ ...largeWindow, width: wideWindow.width });

  await expectColumnNotToScrollSideways(page);
  const marker = await boxOf(page.getByRole("main").getByRole("button", { exact: true, name: "Thread #1" }));
  const code = await boxOf(article.locator("pre"));
  expect(marker.x).toBeGreaterThanOrEqual(code.x + code.width);
});

test("must keep Comment inside the doc column when only the window's width changes after the user selects text in a wide block", async ({
  page,
  review,
}) => {
  await openWideBlocksDoc(page, review, { source: longCodeLineDoc });
  await selectText(page, "1500", "1500");
  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeVisible();

  await page.setViewportSize({ ...largeWindow, width: wideWindow.width });

  await expectColumnNotToScrollSideways(page);
  await expect(page.getByRole("button", { exact: true, name: "Comment" })).toBeInViewport({ ratio: 1 });
});

test("must show Comment past the prose beside a selection that ends in a wide table when the window is large", async ({
  page,
  review,
}) => {
  const article = await openWideBlocksDoc(page, review);

  await selectText(page, "Platform", "team");

  const selectionEnd = await page.evaluate(() => getSelection()?.getRangeAt(0).getBoundingClientRect().right ?? 0);
  const button = await boxOf(page.getByRole("button", { exact: true, name: "Comment" }));
  const prose = await boxOf(article);
  const column = await boxOf(page.getByRole("main"));
  expect(selectionEnd).toBeGreaterThan(prose.x + prose.width);
  expect(button.x).toBeGreaterThan(prose.x + prose.width);
  expect(selectionEnd - button.x).toBeLessThan(button.width);
  expect(button.x + button.width).toBeLessThanOrEqual(column.x + column.width);
});

test("must put a thread's marker just right of what a table shows when the table scrolls", async ({ page, review }) => {
  const table = await openPlanWithScrollingTable(page, review);

  await writeDraftComment(page, "Configuration1", "Configuration1", "Rename?");

  const marker = await boxOf(page.getByRole("main").getByRole("button", { exact: true, name: "Thread #1" }));
  const shown = await boxOf(table);
  const column = await boxOf(page.getByRole("main"));
  expect(marker.x).toBeGreaterThanOrEqual(shown.x + shown.width);
  expect(marker.x + marker.width).toBeLessThanOrEqual(column.x + column.width);
});

test("must line the + up with a heading's line and keep it clear of the heading's frame", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const heading = page.getByRole("article", { name: "docs/plan.md" }).getByRole("heading", { level: 1, name: "Plan" });
  await heading.hover();

  await page.getByRole("button", { name: "Comment on this block" }).hover();

  const button = await boxOf(page.getByRole("button", { name: "Comment on this block" }));
  const line = await boxOf(heading);
  const frame = await boxOf(page.getByTestId("block-target"));
  expect(Math.abs(button.y + button.height / 2 - (line.y + line.height / 2))).toBeLessThanOrEqual(2);
  expect(frame.x - (button.x + button.width)).toBeGreaterThanOrEqual(4);
});

for (const { size, width } of [
  { size: wideWindow, width: "wide" },
  { size: narrowWindow, width: "narrow" },
  { size: phoneWindow, width: "very narrow" },
]) {
  test(`must show the About popover in full from the top bar's right end when the window is ${width}`, async ({
    page,
    review,
  }) => {
    await page.setViewportSize(size);
    await review.open("docs/plan.md");

    await aboutButton(page).click();

    const about = page.getByRole("dialog", { name: "About Markdown Review" });
    await expect(about).toContainText(/Version \d+\.\d+\.\d+/u);
    await expect(about).toBeInViewport({ ratio: 1 });
  });
}

test("must list the licences of the bundled packages when the user follows Third-party licences", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await aboutButton(page).click();
  const opened = page.waitForEvent("popup");

  await page.getByRole("link", { name: "Third-party licences" }).click();

  const licences = await opened;
  await expect(licences.locator("body")).toContainText("## react - ");
  await expect(licences.locator("body")).toContainText("## @krelborn/stylesui - ");
});

function aboutButton(page: Page): Locator {
  return page.getByRole("banner").getByRole("button", { name: "About Markdown Review" });
}

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

/**
 * @returns how many lines the element's text takes on the page
 */
function linesIn(element: Locator): Promise<number> {
  return element.evaluate((shown) => {
    const range = document.createRange();
    range.selectNodeContents(shown);
    return new Set([...range.getClientRects()].map((box) => Math.round(box.top))).size;
  });
}

/**
 * @returns the element's line height as a multiple of its font size
 */
function lineHeightRatio(element: Locator): Promise<number> {
  return element.evaluate((shown) => {
    const style = getComputedStyle(shown);
    return parseFloat(style.lineHeight) / parseFloat(style.fontSize);
  });
}

/**
 * Expects a block to start at the prose's left edge and reach as far past its right edge as a wide block may
 */
function expectToFillTheRoom(block: { width: number; x: number }, prose: { width: number; x: number }): void {
  expect(block.x).toBeCloseTo(prose.x, 0);
  expect(block.x + block.width - (prose.x + prose.width)).toBeCloseTo(prose.width * wideRoomShare, 0);
}

/**
 * Waits for the doc column to fit its contents, with nothing past its right edge
 */
async function expectColumnNotToScrollSideways(page: Page): Promise<void> {
  await expect.poll(() => page.getByRole("main").evaluate((main) => main.scrollWidth <= main.clientWidth)).toBe(true);
}

/**
 * Opens a doc with blocks that need more room than the prose has
 *
 * @param options.size the window, large by default
 * @param options.source the doc, by default one with a block of each kind
 * @returns the rendered doc
 */
async function openWideBlocksDoc(
  page: Page,
  review: ReviewFixture,
  { size = largeWindow, source = wideBlocksDoc }: { size?: typeof largeWindow; source?: string } = {}
): Promise<Locator> {
  await page.setViewportSize(size);
  await review.writeDocument("docs/plan.md", source);
  await review.open("docs/plan.md");
  return page.getByRole("article", { name: "docs/plan.md" });
}

/**
 * Opens a doc whose table is too wide for the doc column, so the table scrolls
 *
 * @returns the table
 */
async function openPlanWithScrollingTable(page: Page, review: ReviewFixture): Promise<Locator> {
  const cells = Array.from({ length: 12 }, (_, index) => `Configuration${index + 1}`);
  const row = (rowCells: string[]): string => `| ${rowCells.join(" | ")} |`;
  await review.writeDocument("docs/plan.md", [plan, row(cells), row(cells.map(() => "-")), row(cells)].join("\n"));
  await review.open("docs/plan.md");
  const table = page.getByRole("article", { name: "docs/plan.md" }).getByRole("table");
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  return table;
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
  await expect(page.getByRole("heading", { level: 1, name: "spec.md" })).toBeVisible();
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
