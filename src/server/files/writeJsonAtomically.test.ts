import { open, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { writeJsonAtomically } from "./writeJsonAtomically";

const getDirectory = setUpTemporaryDirectory();

describe("writeJsonAtomically", () => {
  test("must write formatted JSON and leave no temporary file when the directory does not exist yet", async () => {
    const filePath = path.join(getDirectory(), "nested", "value.json");

    await writeJsonAtomically(filePath, { answer: 42 });

    expect(await readFile(filePath, "utf8")).toBe('{\n  "answer": 42\n}\n');
    expect(await readdir(path.dirname(filePath))).toEqual(["value.json"]);
  });

  test("must replace the previous contents and leave no temporary file when the file already exists", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, "old");

    await writeJsonAtomically(filePath, { answer: 42 });

    expect(await readFile(filePath, "utf8")).toBe('{\n  "answer": 42\n}\n');
    expect(await readdir(getDirectory())).toEqual(["value.json"]);
  });

  test("must keep the old contents for a reader that already opened the file when the file is replaced", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, "old");
    const reader = await open(filePath);

    await writeJsonAtomically(filePath, { answer: 42 });

    const contentsSeenByReader = await reader.readFile("utf8");
    await reader.close();
    expect(contentsSeenByReader).toBe("old");
  });

  test("must leave the existing file untouched and no temporary file when the value cannot be serialised", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, "old");

    await expect(writeJsonAtomically(filePath, { answer: 42n })).rejects.toThrow(TypeError);

    expect(await readFile(filePath, "utf8")).toBe("old");
    expect(await readdir(getDirectory())).toEqual(["value.json"]);
  });
});
