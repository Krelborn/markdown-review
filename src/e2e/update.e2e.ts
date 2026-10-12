import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect } from "@playwright/test";

import { test } from "./testing/reviewTest";

test("must show the newer version in the About popover when the update check has found one", async ({
  page,
  review,
}) => {
  const cachePath = path.join(review.root, ".home", ".cache", "markdown-review", "update-check.json");
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify({ checkedAt: new Date().toISOString(), distTags: { latest: "99.0.0" } }));
  await review.open("docs/plan.md", {
    CI: "",
    MARKDOWN_REVIEW_NO_UPDATE_CHECK: "",
    MARKDOWN_REVIEW_REGISTRY_URL: "http://127.0.0.1:9",
    NO_UPDATE_NOTIFIER: "",
  });

  await page.getByRole("banner").getByRole("button", { name: "About Markdown Review, update available" }).click();

  await expect(page.getByRole("dialog", { name: "About Markdown Review" })).toContainText(
    "Version 99.0.0 is available. Ask your agent to update it, or run npm install --global @krelborn/markdown-review@latest"
  );
});
