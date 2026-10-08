import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { StoreFiles } from "./StoreFiles";

const getDirectory = setUpTemporaryDirectory();

describe("StoreFiles", () => {
  test("must create a .gitignore that ignores the whole store when the store is new", async () => {
    await new StoreFiles(getDirectory()).ensureStoreDirectory();

    expect(await readFile(path.join(getDirectory(), ".markdown-review", ".gitignore"), "utf8")).toBe("*\n");
  });

  test("must keep the user's .gitignore when they have chosen to commit the store", async () => {
    await mkdir(path.join(getDirectory(), ".markdown-review"));
    await writeFile(path.join(getDirectory(), ".markdown-review", ".gitignore"), "server.json\n");

    await new StoreFiles(getDirectory()).ensureStoreDirectory();

    expect(await readFile(path.join(getDirectory(), ".markdown-review", ".gitignore"), "utf8")).toBe("server.json\n");
  });

  test("must list the docs with threads files as repo-relative paths when they are nested", async () => {
    const files = new StoreFiles(getDirectory());
    const file = { sourceHash: null, threads: [], version: 1 as const };
    await files.writeDocumentFile({ ...file, document: "docs/plans/plan.md" });
    await files.writeDocumentFile({ ...file, document: "README.md" });

    expect(await files.listDocuments()).toEqual(["README.md", "docs/plans/plan.md"]);
  });

  test("must store and list a doc's threads when its name has spaces and non-ASCII characters", async () => {
    const files = new StoreFiles(getDirectory());
    const file = { document: "docs/Design Notes café.md", sourceHash: null, threads: [], version: 1 as const };

    await files.writeDocumentFile(file);

    expect(await files.listDocuments()).toEqual(["docs/Design Notes café.md"]);
    expect(await files.readDocumentFile("docs/Design Notes café.md")).toEqual({ kind: "valid", value: file });
  });

  test("must list no docs when the store has no documents directory", async () => {
    expect(await new StoreFiles(getDirectory()).listDocuments()).toEqual([]);
  });

  test("must read back the review file when one has been written", async () => {
    const files = new StoreFiles(getDirectory());
    const review = { approvedAt: null, requestedAt: "2026-10-08T09:00:00.000Z", threads: [], version: 1 as const };

    await files.writeReviewFile(review);

    expect(await files.readReviewFile()).toEqual({ kind: "valid", value: review });
  });

  test("must return a doc's source, or null when the doc does not exist", async () => {
    const files = new StoreFiles(getDirectory());
    await mkdir(path.join(getDirectory(), "docs"));
    await writeFile(path.join(getDirectory(), "docs", "plan.md"), "# Plan\n");

    const sources = [await files.readDocumentSource("docs/plan.md"), await files.readDocumentSource("docs/missing.md")];

    expect(sources).toEqual(["# Plan\n", null]);
  });

  test("must return an empty review when review.json does not exist", async () => {
    expect(await new StoreFiles(getDirectory()).readReviewFile()).toEqual({
      kind: "valid",
      value: { approvedAt: null, requestedAt: null, threads: [], version: 1 },
    });
  });
});
