import { readFile } from "node:fs/promises";

import { expect, test } from "vitest";

interface SiteImage {
  alt: string;
  height: number;
  source: string;
  width: number;
}

const sitePages = ["index.html", "docs.html"];

test.each(sitePages)("must give each screenshot on %s the size it shows at, half its size in pixels", async (page) => {
  const images = await readImages(page);

  const shownSizes = await Promise.all(images.map(({ source }) => readShownSize(source)));

  expect(images.map(({ height, source, width }) => ({ height, source, width }))).toEqual(shownSizes);
});

test.each(sitePages)("must describe each screenshot on %s, in either colour mode", async (page) => {
  const images = await readImages(page);

  expect(images.filter(({ alt }) => alt.trim() === "").map(({ source }) => source)).toEqual([]);
});

/**
 * @param page the page's file name in `site/`
 * @returns each image the page shows, with the size its attributes give it
 */
async function readImages(page: string): Promise<SiteImage[]> {
  const html = await readFile(new URL(`../../site/${page}`, import.meta.url), "utf8");
  return [...html.matchAll(/<img\b[^>]*>/gu)].map(([tag]) => {
    const attributes = new Map(
      [...tag.matchAll(/\b(alt|height|src|width)="([^"]*)"/gu)].map(([, name, value]) => [name, value])
    );
    return {
      alt: attributes.get("alt") ?? "",
      height: Number(attributes.get("height")),
      source: attributes.get("src") ?? "",
      width: Number(attributes.get("width")),
    };
  });
}

/**
 * @param source the image's path, relative to `site/`
 * @returns the image's size on the page, half its size in pixels, since the screenshots are taken at 2x
 */
async function readShownSize(source: string): Promise<Omit<SiteImage, "alt">> {
  const png = await readFile(new URL(`../../site/${source}`, import.meta.url));
  return { height: png.readUInt32BE(20) / 2, source, width: png.readUInt32BE(16) / 2 };
}
