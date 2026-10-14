import { readFile, stat } from "node:fs/promises";

import { expect, test } from "vitest";

const siteDirectory = new URL("../../site/", import.meta.url);

const sitePages = ["index.html", "docs.html"];

test.each(sitePages)("must find each file and element %s refers to when the site is deployed", async (page) => {
  const references = await readReferences(page);

  const missing = await findMissing(page, references);

  expect(references).not.toEqual([]);
  expect(missing).toEqual([]);
});

/**
 * @param page the page's file name in `site/`
 * @returns the files and elements in the site that the page's links, sources and `aria-controls` refer to
 */
async function readReferences(page: string): Promise<string[]> {
  const html = await readFile(new URL(page, siteDirectory), "utf8");
  return [...html.matchAll(/\s(aria-controls|href|src)="([^"]*)"/gu)]
    .map(([, name, value = ""]) => (name === "aria-controls" ? `#${value}` : value))
    .filter((reference) => !/^[a-z]+:/u.test(reference));
}

/**
 * @param page the page's file name in `site/`
 * @param references the page's references, relative to the page
 * @returns the references to a file that does not exist, or to an id the file does not have
 */
async function findMissing(page: string, references: string[]): Promise<string[]> {
  const missing: string[] = [];
  for (const reference of references) {
    const target = new URL(reference, new URL(page, siteDirectory));
    const id = target.hash.slice(1);
    target.hash = "";
    const isFound = await stat(target).then(
      () => true,
      () => false
    );
    if (!isFound || (id !== "" && !(await readIds(target)).has(id))) {
      missing.push(reference);
    }
  }
  return missing;
}

/**
 * @param file an HTML file in the site
 * @returns the ids of the file's elements
 */
async function readIds(file: URL): Promise<Set<string>> {
  const html = await readFile(file, "utf8");
  return new Set([...html.matchAll(/\sid="([^"]*)"/gu)].map(([, id = ""]) => id));
}
