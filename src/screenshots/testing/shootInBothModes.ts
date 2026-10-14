import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const imagesDirectory = fileURLToPath(new URL("../../../docs/images/", import.meta.url));

export interface Clip {
  height: number;
  width: number;
  x: number;
  y: number;
}

/**
 * Saves a screenshot of the page in light mode to `docs/images/<name>-light.png` and one in dark mode to
 * `docs/images/<name>-dark.png`, then leaves the page in light mode
 *
 * @param name the screenshots' name, which the README and the site refer to them by
 * @param clip the part of the page to take, in CSS pixels; the whole viewport when left out
 */
export async function shootInBothModes(page: Page, name: string, clip?: Clip): Promise<void> {
  for (const colorScheme of ["light", "dark"] as const) {
    await showColorScheme(page, colorScheme);
    await page.screenshot({
      animations: "disabled",
      clip,
      path: path.join(imagesDirectory, `${name}-${colorScheme}.png`),
    });
  }
  await showColorScheme(page, "light");
}

/**
 * Switches the page's colour mode, and waits until every Mermaid diagram on it is drawn again in that mode's colours
 */
async function showColorScheme(page: Page, colorScheme: "dark" | "light"): Promise<void> {
  const isDark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  if (isDark === (colorScheme === "dark")) {
    return;
  }
  const diagrams = page.locator("[data-mermaid-definition] > svg");
  const drawn = await diagrams.evaluateAll((svgs) => svgs.map((svg) => svg.id));
  await page.emulateMedia({ colorScheme });
  await expect
    .poll(() => diagrams.evaluateAll((svgs, before) => svgs.every((svg) => !before.includes(svg.id)), drawn))
    .toBe(true);
}
