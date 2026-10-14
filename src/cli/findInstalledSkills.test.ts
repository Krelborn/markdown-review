import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { findInstalledSkills } from "./findInstalledSkills";
import type { SkillDirectory } from "./skillDirectories";
import { skillInstallPath } from "./skillDirectories";
import { stampSkill } from "./skillStamps";

const getDirectory = setUpTemporaryDirectory();

const skill = "---\nname: markdown-review\n---\n# Markdown Review\n";

describe("findInstalledSkills", () => {
  test("must find no copies when the skill is not installed", async () => {
    const { home, root } = setUpTest();

    expect(await findInstalledSkills(root, home)).toEqual([]);
  });

  test("must report the version that installed each copy, the repo's first, when every location has one", async () => {
    const { home, install, root } = setUpTest();
    await install(home, "agents", stampSkill(skill, "0.4.0"));
    await install(home, "claude", stampSkill(skill, "0.3.0"));
    await install(root, "agents", stampSkill(skill, "0.5.0"));
    await install(root, "claude", skill);

    expect(await findInstalledSkills(root, home)).toEqual([
      { directory: "claude", isGlobal: false, path: skillInstallPath(root, "claude"), version: null },
      { directory: "agents", isGlobal: false, path: skillInstallPath(root, "agents"), version: "0.5.0" },
      { directory: "claude", isGlobal: true, path: skillInstallPath(home, "claude"), version: "0.3.0" },
      { directory: "agents", isGlobal: true, path: skillInstallPath(home, "agents"), version: "0.4.0" },
    ]);
  });

  test("must find only the copies that exist when some locations have none", async () => {
    const { home, install, root } = setUpTest();
    await install(root, "agents", skill);
    await install(home, "claude", skill);

    expect(await findInstalledSkills(root, home)).toEqual([
      { directory: "agents", isGlobal: false, path: skillInstallPath(root, "agents"), version: null },
      { directory: "claude", isGlobal: true, path: skillInstallPath(home, "claude"), version: null },
    ]);
  });
});

function setUpTest() {
  const root = path.join(getDirectory(), "repo");
  const home = path.join(getDirectory(), "home");
  const install = async (base: string, directory: SkillDirectory, contents: string): Promise<void> => {
    const skillPath = skillInstallPath(base, directory);
    await mkdir(path.dirname(skillPath), { recursive: true });
    await writeFile(skillPath, contents);
  };
  return { home, install, root };
}
