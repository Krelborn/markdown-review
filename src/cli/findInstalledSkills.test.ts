import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { findInstalledSkills } from "./findInstalledSkills";
import { skillInstallPath } from "./skillInstallPath";

const getDirectory = setUpTemporaryDirectory();

const bundled = "# Markdown Review\n";

describe("findInstalledSkills", () => {
  test("must find no copies when the skill is not installed", async () => {
    const { home, root } = setUpTest();

    expect(await findInstalledSkills(root, home, bundled)).toEqual([]);
  });

  test("must report whether each installed copy is the bundled skill", async () => {
    const { home, install, root } = setUpTest();
    await install(root, "# An older skill\n");
    await install(home, bundled);

    expect(await findInstalledSkills(root, home, bundled)).toEqual([
      { isCurrent: false, isGlobal: false, path: skillInstallPath(root) },
      { isCurrent: true, isGlobal: true, path: skillInstallPath(home) },
    ]);
  });
});

function setUpTest() {
  const root = path.join(getDirectory(), "repo");
  const home = path.join(getDirectory(), "home");
  const install = async (base: string, contents: string): Promise<void> => {
    await mkdir(path.dirname(skillInstallPath(base)), { recursive: true });
    await writeFile(skillInstallPath(base), contents);
  };
  return { home, install, root };
}
