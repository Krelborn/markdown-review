import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { findInstalledSkills } from "./findInstalledSkills";
import { skillInstallPath } from "./skillInstallPath";
import { stampSkill } from "./skillStamps";

const getDirectory = setUpTemporaryDirectory();

const skill = "---\nname: markdown-review\n---\n# Markdown Review\n";

describe("findInstalledSkills", () => {
  test("must find no copies when the skill is not installed", async () => {
    const { home, root } = setUpTest();

    expect(await findInstalledSkills(root, home)).toEqual([]);
  });

  test("must report the version that installed each copy, the repo's first, when both are installed", async () => {
    const { home, install, root } = setUpTest();
    await install(home, stampSkill(skill, "0.3.0"));
    await install(root, skill);

    expect(await findInstalledSkills(root, home)).toEqual([
      { isGlobal: false, path: skillInstallPath(root), version: null },
      { isGlobal: true, path: skillInstallPath(home), version: "0.3.0" },
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
