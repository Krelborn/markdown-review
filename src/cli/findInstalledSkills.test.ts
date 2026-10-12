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

    expect(await findInstalledSkills(root, home, "0.3.0")).toEqual([]);
  });

  test.each([
    { contents: stampSkill(skill, "0.3.0"), isCurrent: true, installedBy: "the running version" },
    { contents: stampSkill(`${skill}A later line\n`, "0.4.0"), isCurrent: true, installedBy: "a newer version" },
    { contents: stampSkill(skill, "0.2.0"), isCurrent: false, installedBy: "an older version" },
    { contents: skill, isCurrent: false, installedBy: "a version that did not stamp it" },
    { contents: stampSkill(skill, "not-a-version"), isCurrent: false, installedBy: "an unreadable version" },
  ])(
    "must report isCurrent $isCurrent when the copy was installed by $installedBy",
    async ({ contents, isCurrent }) => {
      const { home, install, root } = setUpTest();
      await install(root, contents);

      expect(await findInstalledSkills(root, home, "0.3.0")).toEqual([
        { isCurrent, isGlobal: false, path: skillInstallPath(root) },
      ]);
    }
  );

  test("must list the repo's copy before the home directory's when both are installed", async () => {
    const { home, install, root } = setUpTest();
    await install(home, stampSkill(skill, "0.3.0"));
    await install(root, skill);

    expect(await findInstalledSkills(root, home, "0.3.0")).toEqual([
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
