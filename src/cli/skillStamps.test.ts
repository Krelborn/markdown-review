import { describe, expect, test } from "vitest";

import bundledSkill from "../../skills/markdown-review/SKILL.md?raw";

import { readSkillStamp, stampSkill } from "./skillStamps";

describe("skillStamps", () => {
  test("must add the version to the bundled skill's frontmatter and change nothing else", () => {
    const stamped = stampSkill(bundledSkill, "0.3.0");

    expect(stamped).toBe(bundledSkill.replace("\n---\n", "\nmetadata:\n  version: 0.3.0\n---\n"));
    expect(readSkillStamp(stamped)).toBe("0.3.0");
  });

  test("must keep the skill's own metadata when it stamps the version", () => {
    const skill = "---\nname: example\nmetadata:\n  author: someone\n---\n# Example\n";

    expect(stampSkill(skill, "0.3.0")).toBe(
      "---\nname: example\nmetadata:\n  author: someone\n  version: 0.3.0\n---\n# Example\n"
    );
  });

  test("must refuse a skill when it has no frontmatter", () => {
    expect(() => stampSkill("# Example\n", "0.3.0")).toThrow("The skill has no frontmatter to stamp");
  });

  test.each([
    { condition: "the copy has no frontmatter", installed: "# Example\n" },
    { condition: "the frontmatter has no metadata", installed: "---\nname: example\n---\n# Example\n" },
    { condition: "the version is not a string", installed: "---\nmetadata:\n  version: 3\n---\n# Example\n" },
  ])("must read no version when $condition", ({ installed }) => {
    expect(readSkillStamp(installed)).toBeNull();
  });

  test("must read the version when the copy has Windows line endings", () => {
    expect(readSkillStamp("---\r\nname: example\r\nmetadata:\r\n  version: 0.3.0\r\n---\r\n# Example\r\n")).toBe(
      "0.3.0"
    );
  });
});
