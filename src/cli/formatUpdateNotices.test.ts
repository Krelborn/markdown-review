import { describe, expect, test } from "vitest";

import type { InstalledSkill } from "./findInstalledSkills";
import { formatUpdateNotices } from "./formatUpdateNotices";

const repositorySkill: InstalledSkill = { isCurrent: true, isGlobal: false, path: "/repo/.claude/skills/x/SKILL.md" };

const globalSkill: InstalledSkill = { isCurrent: true, isGlobal: true, path: "/home/.claude/skills/x/SKILL.md" };

describe("formatUpdateNotices", () => {
  test("must say nothing when there is no update and every skill is current", () => {
    expect(
      formatUpdateNotices({
        approved: true,
        availableUpdate: null,
        currentVersion: "0.3.0",
        installKind: "global",
        skills: [repositorySkill, globalSkill],
      })
    ).toEqual([]);
  });

  test("must tell the agent to mention the update and wait when the review is not approved", () => {
    expect(
      formatUpdateNotices({
        approved: false,
        availableUpdate: "0.4.0",
        currentVersion: "0.3.0",
        installKind: "global",
        skills: [{ ...globalSkill, isCurrent: false }],
      })
    ).toEqual([
      "update_available: markdown-review 0.4.0 is out; this is 0.3.0. Tell the user, and offer to update once they approve the review.\n",
    ]);
  });

  test("must give every update command for a global install when the review is approved", () => {
    expect(
      formatUpdateNotices({
        approved: true,
        availableUpdate: "0.4.0",
        currentVersion: "0.3.0",
        installKind: "global",
        skills: [repositorySkill, globalSkill],
      })
    ).toEqual([
      "update_available: markdown-review 0.4.0 is out; this is 0.3.0. Ask the user whether to update. If they agree, " +
        "run `npm install --global @krelborn/markdown-review@latest`, then `markdown-review stop`, " +
        "then `markdown-review install-skill`, then `markdown-review install-skill --global`.\n",
    ]);
  });

  test("must run the commands through npx@latest when markdown-review runs from npx", () => {
    expect(
      formatUpdateNotices({
        approved: true,
        availableUpdate: "0.4.0",
        currentVersion: "0.3.0",
        installKind: "npx",
        skills: [],
      })
    ).toEqual([
      "update_available: markdown-review 0.4.0 is out; this is 0.3.0. Ask the user whether to update. If they agree, " +
        "run `npx @krelborn/markdown-review@latest stop`, " +
        "and from now on run markdown-review as `npx @krelborn/markdown-review@latest`.\n",
    ]);
  });

  test.each([
    { approved: false, when: "Once the user approves the review, run" },
    { approved: true, when: "Run" },
  ])("must name each outdated skill and how to refresh it when approved is $approved", ({ approved, when }) => {
    expect(
      formatUpdateNotices({
        approved,
        availableUpdate: null,
        currentVersion: "0.3.0",
        installKind: "global",
        skills: [{ ...repositorySkill, isCurrent: false }, globalSkill],
      })
    ).toEqual([
      "skill_outdated: The markdown-review skill at /repo/.claude/skills/x/SKILL.md is not this version's (0.3.0). " +
        `${when} \`markdown-review install-skill\`. The new skill loads in the next agent session.\n`,
    ]);
  });
});
