import { describe, expect, test } from "vitest";

import type { InstalledSkill } from "./findInstalledSkills";
import { formatUpdateNotices } from "./formatUpdateNotices";

const repositorySkill: InstalledSkill = { isGlobal: false, path: "/repo/.claude/skills/x/SKILL.md", version: "0.3.0" };

const globalSkill: InstalledSkill = { isGlobal: true, path: "/home/.claude/skills/x/SKILL.md", version: "0.3.0" };

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
        availableUpdate: { distTag: "latest", version: "0.4.0" },
        currentVersion: "0.3.0",
        installKind: "global",
        skills: [{ ...globalSkill, version: null }],
      })
    ).toEqual([
      "update_available: markdown-review 0.4.0 is out; this is 0.3.0. Tell the user, and offer to update once they approve the review.\n",
    ]);
  });

  test("must give every update command for a global install when the review is approved", () => {
    expect(
      formatUpdateNotices({
        approved: true,
        availableUpdate: { distTag: "latest", version: "0.4.0" },
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

  test("must leave out a skill that a version at least as new as the update installed", () => {
    expect(
      formatUpdateNotices({
        approved: true,
        availableUpdate: { distTag: "latest", version: "0.4.0" },
        currentVersion: "0.3.0",
        installKind: "global",
        skills: [{ ...repositorySkill, version: "0.5.0-beta.1" }, globalSkill],
      })
    ).toEqual([
      "update_available: markdown-review 0.4.0 is out; this is 0.3.0. Ask the user whether to update. If they agree, " +
        "run `npm install --global @krelborn/markdown-review@latest`, then `markdown-review stop`, " +
        "then `markdown-review install-skill --global`.\n",
    ]);
  });

  test("must run the commands through npx@latest when markdown-review runs from npx", () => {
    expect(
      formatUpdateNotices({
        approved: true,
        availableUpdate: { distTag: "latest", version: "0.4.0" },
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
    {
      expected: "run `npm install --global @krelborn/markdown-review@next`, then `markdown-review stop`.\n",
      installKind: "global",
    },
    {
      expected:
        "run `npx @krelborn/markdown-review@next stop`, and from now on run markdown-review as " +
        "`npx @krelborn/markdown-review@next`.\n",
      installKind: "npx",
    },
  ] as const)(
    "must install the next tag when the update is a $installKind pre-release from it",
    ({ expected, installKind }) => {
      const [notice] = formatUpdateNotices({
        approved: true,
        availableUpdate: { distTag: "next", version: "0.4.0-beta.2" },
        currentVersion: "0.4.0-beta.1",
        installKind,
        skills: [],
      });

      expect(notice?.endsWith(`If they agree, ${expected}`)).toBe(true);
    }
  );

  test("must refresh an outdated skill with the running version when markdown-review runs from npx", () => {
    expect(
      formatUpdateNotices({
        approved: true,
        availableUpdate: null,
        currentVersion: "0.4.0-beta.1",
        installKind: "npx",
        skills: [{ ...globalSkill, version: null }],
      })
    ).toEqual([
      "skill_outdated: The markdown-review skill at /home/.claude/skills/x/SKILL.md is older than this version " +
        "(0.4.0-beta.1). Run `npx @krelborn/markdown-review@0.4.0-beta.1 install-skill --global`. The new skill loads " +
        "in the next agent session.\n",
    ]);
  });

  test.each([
    { installedBy: "the running version", isOutdated: false, version: "0.3.0" },
    { installedBy: "a newer version", isOutdated: false, version: "0.4.0" },
    { installedBy: "an older version", isOutdated: true, version: "0.2.0" },
    { installedBy: "a version that did not stamp it", isOutdated: true, version: null },
    { installedBy: "an unreadable version", isOutdated: true, version: "not-a-version" },
  ])("must call the skill outdated only when $installedBy installed it", ({ isOutdated, version }) => {
    const notices = formatUpdateNotices({
      approved: true,
      availableUpdate: null,
      currentVersion: "0.3.0",
      installKind: "global",
      skills: [{ ...repositorySkill, version }],
    });

    expect(notices.length > 0).toBe(isOutdated);
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
        skills: [{ ...repositorySkill, version: null }, globalSkill],
      })
    ).toEqual([
      "skill_outdated: The markdown-review skill at /repo/.claude/skills/x/SKILL.md is older than this version (0.3.0). " +
        `${when} \`markdown-review install-skill\`. The new skill loads in the next agent session.\n`,
    ]);
  });
});
