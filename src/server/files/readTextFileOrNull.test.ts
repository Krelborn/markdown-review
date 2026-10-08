import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { readTextFileOrNull } from "./readTextFileOrNull";

const getDirectory = setUpTemporaryDirectory();

describe("readTextFileOrNull", () => {
  test("must return the contents when the file exists", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, '{ "answer": 42 }');

    expect(await readTextFileOrNull(filePath)).toBe('{ "answer": 42 }');
  });

  test("must return null when the file does not exist", async () => {
    expect(await readTextFileOrNull(path.join(getDirectory(), "missing.json"))).toBeNull();
  });

  test("must reject when the file cannot be read for another reason", async () => {
    const filePath = path.join(getDirectory(), "directory.json");
    await mkdir(filePath);

    await expect(readTextFileOrNull(filePath)).rejects.toThrow();
  });
});
