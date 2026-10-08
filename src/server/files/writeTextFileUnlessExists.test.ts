import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { writeTextFileUnlessExists } from "./writeTextFileUnlessExists";

const getDirectory = setUpTemporaryDirectory();

describe("writeTextFileUnlessExists", () => {
  test("must create the file and return true when no file exists", async () => {
    const filePath = path.join(getDirectory(), "kept.json");

    const written = await writeTextFileUnlessExists(filePath, "new");

    expect(written).toBe(true);
    expect(await readFile(filePath, "utf8")).toBe("new");
  });

  test("must leave the file alone and return false when a file already exists", async () => {
    const filePath = path.join(getDirectory(), "kept.json");
    await writeFile(filePath, "first");

    const written = await writeTextFileUnlessExists(filePath, "new");

    expect(written).toBe(false);
    expect(await readFile(filePath, "utf8")).toBe("first");
  });

  test("must reject with the file system error when the file cannot be created", async () => {
    const filePath = path.join(getDirectory(), "missing", "kept.json");

    await expect(writeTextFileUnlessExists(filePath, "new")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
