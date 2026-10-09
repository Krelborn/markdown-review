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
