import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { z } from "zod";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { readStoreFile } from "./readStoreFile";

const getDirectory = setUpTemporaryDirectory();

const schema = z.strictObject({ answer: z.number() });

describe("readStoreFile", () => {
  test("must return null when the file does not exist", async () => {
    expect(await readStoreFile(path.join(getDirectory(), "missing.json"), schema)).toEqual({
      kind: "valid",
      value: null,
    });
  });

  test("must return the value when the file matches the schema", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, '{ "answer": 42 }');

    expect(await readStoreFile(filePath, schema)).toEqual({ kind: "valid", value: { answer: 42 } });
  });

  test.each([
    { condition: "the file is not JSON", contents: "{ not json", problem: "is not valid JSON" },
    {
      condition: "the file does not match the schema",
      contents: '{ "answer": "42" }',
      problem: "is not a valid store file",
    },
  ])("must describe the problem, naming the file, when $condition", async ({ contents, problem }) => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, contents);

    const result = await readStoreFile(filePath, schema);

    expect(result).toMatchObject({ kind: "invalid" });
    expect(result.kind === "invalid" ? result.problem : "").toContain(`${filePath} ${problem}`);
  });
});
