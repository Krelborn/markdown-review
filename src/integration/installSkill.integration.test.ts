import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import skill from "../../skills/markdown-review/SKILL.md?raw";

import { setUpReviewRepository } from "./testing/setUpReviewRepository";

const getRepository = setUpReviewRepository();

describe("install-skill", () => {
  test("must write the skill the package was built with when the agent installs it", async () => {
    const repository = getRepository();

    const { exitCode } = await repository.run(["install-skill"]);

    const skillPath = path.join(repository.root, ".claude", "skills", "markdown-review", "SKILL.md");
    expect(exitCode).toBe(0);
    expect(await readFile(skillPath, "utf8")).toBe(skill);
  });
});
