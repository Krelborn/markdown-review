import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { DocumentWatcher } from "./DocumentWatcher";

const getDirectory = setUpTemporaryDirectory();

describe("DocumentWatcher", () => {
  test("must report the doc's repo-relative path when a watched doc is saved", async () => {
    const root = getDirectory();
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
    const changed: string[] = [];
    const watcher = new DocumentWatcher(root, (document) => changed.push(document));
    watcher.watch("docs/plan.md");
    await new Promise((resolve) => setTimeout(resolve, 200));

    await writeFile(path.join(root, "docs", "plan.md"), "# Plan, edited\n");

    await vi.waitFor(() => expect(changed).toContain("docs/plan.md"), { timeout: 5000 });
    await watcher.close();
  });
});
