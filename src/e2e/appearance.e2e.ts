import { rm } from "node:fs/promises";

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { createGitRepository } from "../integration/testing/createGitRepository";
import { startCli } from "../integration/testing/startCli";
import { stopReviewServer } from "../integration/testing/stopReviewServer";

import { test } from "./testing/reviewTest";

const paperLight = "rgb(244, 241, 234)";

const paperDark = "rgb(27, 25, 22)";

const mistDark = "rgb(15, 20, 27)";

const githubLightKeyword = "rgb(215, 58, 73)";

const githubDarkKeyword = "rgb(249, 117, 131)";

const mermaidLightNode = "rgb(236, 236, 255)";

const mermaidDarkNode = "rgb(31, 32, 32)";

const codeDoc = [
  "# Plan",
  "",
  "```ts",
  "const ttl = 24;",
  "```",
  "",
  "```mermaid",
  "flowchart LR",
  "  A --> B",
  "```",
  "",
].join("\n");

test("must draw the page in Paper, following the browser between light and dark, when the user has chosen nothing", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");

  await expect(page.locator("body")).toHaveCSS("background-color", paperLight);
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("body")).toHaveCSS("background-color", paperDark);
});

test("must keep the chosen mode and palette, from the HTML the server sends, when the user reloads the page", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");

  await chooseAppearance(page, ["Dark", "Mist"]);
  await expect(page.locator("body")).toHaveCSS("background-color", mistDark);
  const reloaded = await page.reload();

  expect(await reloaded?.text()).toContain('<html data-sui-mode="dark" data-sui-palette="mist"');
  await expect(page.locator("body")).toHaveCSS("background-color", mistDark);
});

test("must colour code and diagrams for the page's mode when the user chooses Light in a dark browser", async ({
  page,
  review,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await review.writeDocument("docs/plan.md", codeDoc);
  await review.open("docs/plan.md");
  const article = page.getByRole("article", { name: "docs/plan.md" });
  await expect(article.getByText("const", { exact: true })).toHaveCSS("color", githubDarkKeyword);
  await expect(article.locator(".node rect").first()).toHaveCSS("fill", mermaidDarkNode);

  await chooseAppearance(page, ["Light"]);

  await expect(article.getByText("const", { exact: true })).toHaveCSS("color", githubLightKeyword);
  await expect(article.locator(".node rect").first()).toHaveCSS("fill", mermaidLightNode);
});

test("must apply a choice made in one repo's review when the browser opens another repo's review", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await chooseAppearance(page, ["Dark", "Mist"]);
  const otherRoot = await createGitRepository({ "notes.md": "# Notes\n" });
  const otherPage = await page.context().newPage();
  try {
    const { stdout } = await startCli(otherRoot, ["open", "notes.md"]).result;

    await otherPage.goto(stdout.slice(stdout.indexOf("http"), stdout.indexOf("\n")));

    await expect(otherPage.getByRole("banner").getByRole("heading", { level: 1, name: "notes.md" })).toBeVisible();
    await expect(otherPage.locator("html")).toHaveAttribute("data-sui-palette", "mist");
    await expect(otherPage.locator("body")).toHaveCSS("background-color", mistDark);
  } finally {
    await otherPage.close();
    await stopReviewServer(otherRoot);
    await rm(otherRoot, { force: true, recursive: true });
  }
});

async function chooseAppearance(page: Page, choices: string[]): Promise<void> {
  await page.getByRole("button", { name: "Appearance" }).click();
  const popover = page.getByRole("dialog", { name: "Appearance" });
  for (const choice of choices) {
    await popover.getByRole("radio", { name: choice }).check();
  }
}
