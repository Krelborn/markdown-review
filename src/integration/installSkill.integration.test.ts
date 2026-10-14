import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import skill from "../../skills/markdown-review/SKILL.md?raw";
import { stampSkill } from "../cli/skillStamps";
import { packageVersion } from "../server/runtime/packageVersion";

import { setUpReviewRepository } from "./testing/setUpReviewRepository";

const getRepository = setUpReviewRepository();

describe("install-skill", () => {
  test("must write the skill the package was built with to both skills directories when no --only is given", async () => {
    const repository = getRepository();

    const { exitCode } = await repository.run(["install-skill"]);

    expect(exitCode).toBe(0);
    expect(await readSkillCopy(repository.root, ".claude")).toBe(stampSkill(skill, packageVersion));
    expect(await readSkillCopy(repository.root, ".agents")).toBe(stampSkill(skill, packageVersion));
  });

  test("must write the skill to just the agents' skills directory when the agent passes --only agents", async () => {
    const repository = getRepository();

    const { exitCode } = await repository.run(["install-skill", "--only", "agents"]);

    expect(exitCode).toBe(0);
    expect(await readSkillCopy(repository.root, ".agents")).toBe(stampSkill(skill, packageVersion));
    expect(await readSkillCopy(repository.root, ".claude")).toBeNull();
  });
});

/**
 * @param root the repo root
 * @param directory the directory that holds the skills directory, ".claude" or ".agents"
 * @returns the copy of the skill installed there, or null when there is none
 */
function readSkillCopy(root: string, directory: string): Promise<string | null> {
  return readFile(path.join(root, directory, "skills", "markdown-review", "SKILL.md"), "utf8").catch(() => null);
}
