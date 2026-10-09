import { expect } from "@playwright/test";

import { plan, test } from "./testing/reviewTest";

test("must put a heading's section in the page address when the user clicks the heading's link", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", `${plan}\n## Goals\n\nShip it.\n`);
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });

  await article.getByRole("heading", { name: "Goals" }).hover();
  await article.getByRole("link", { name: "Link to Goals" }).click();

  await expect(page).toHaveURL(/#goals$/);
});

test("must show frontmatter as properties and take a comment on the whole of it when the doc starts with frontmatter", async ({
  page,
  review,
}) => {
  await review.writeDocument("docs/plan.md", `---\ntitle: Plan\nstatus: draft\n---\n\n${plan}`);
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });
  await expect(article.getByRole("term")).toHaveText(["title", "status"]);

  await article.getByRole("definition").first().hover();
  await page.getByRole("button", { name: "Comment on this block" }).click();
  await page.keyboard.type("Status should be review.");
  await page.getByRole("region", { name: "New comment" }).getByRole("button", { exact: true, name: "Save" }).click();

  await expect(page.getByRole("region", { name: "Drafts" }).getByRole("article")).toContainText("status: draft");
});
