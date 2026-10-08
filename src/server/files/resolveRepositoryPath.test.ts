import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { resolveRepositoryPath } from "./resolveRepositoryPath";

const getDirectory = setUpTemporaryDirectory();

describe("resolveRepositoryPath", () => {
  test("must return the real path when the file is inside the repo", async () => {
    const { root } = await setUpTest();

    const resolved = await resolveRepositoryPath(root, "docs/plan.md");

    expect(resolved).toMatchObject({ kind: "inside" });
    expect(resolved.kind === "inside" && resolved.absolutePath.endsWith(path.join("docs", "plan.md"))).toBe(true);
  });

  test("must report the file missing when nothing exists at the path", async () => {
    const { root } = await setUpTest();

    expect(await resolveRepositoryPath(root, "docs/missing.md")).toEqual({ kind: "missing" });
  });

  test("must refuse the path when it climbs out of the repo", async () => {
    const { root } = await setUpTest();

    expect(await resolveRepositoryPath(root, "../secret.md")).toEqual({ kind: "invalid" });
  });

  test("must refuse the path when a symlink inside the repo leads out of it", async () => {
    const { root } = await setUpTest();
    await symlink(path.join(getDirectory(), "secret.md"), path.join(root, "docs", "linked.md"));

    expect(await resolveRepositoryPath(root, "docs/linked.md")).toEqual({ kind: "outside" });
  });

  test.each([
    { condition: "the path is the review store", relativePath: ".markdown-review" },
    { condition: "the path is in the review store", relativePath: ".markdown-review/server.json" },
    { condition: "a symlink inside the repo leads into the review store", relativePath: "docs/token.json" },
  ])("must refuse the path as private when $condition, which holds the server's token", async ({ relativePath }) => {
    const { root } = await setUpTest();
    await mkdir(path.join(root, ".markdown-review"));
    await writeFile(path.join(root, ".markdown-review", "server.json"), "{}\n");
    await symlink(path.join(root, ".markdown-review", "server.json"), path.join(root, "docs", "token.json"));

    expect(await resolveRepositoryPath(root, relativePath)).toEqual({ kind: "private" });
  });
});

async function setUpTest() {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  await writeFile(path.join(getDirectory(), "secret.md"), "secret\n");
  return { root };
}
