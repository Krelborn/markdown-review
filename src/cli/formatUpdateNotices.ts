import type { NewerRelease } from "../server/update/findAvailableUpdate";
import type { InstallKind } from "../server/update/installCommands";
import { cliCommand, globalInstallCommand, npxCommand } from "../server/update/installCommands";
import { compareVersions } from "../server/update/semanticVersions";

import type { InstalledSkill } from "./findInstalledSkills";

export interface UpdateNoticesInput {
  /**
   * The newer version on npm and its dist-tag, or null when none is known
   */
  availableUpdate: NewerRelease | null;

  currentVersion: string;
  installKind: InstallKind;
  skills: readonly InstalledSkill[];

  /**
   * Whether the user said go ahead, which is when the agent should act on the notices
   */
  wentAhead: boolean;
}

/**
 * Describes a newer markdown-review and outdated copies of the skill for the agent
 *
 * @returns the `update_available` and `skill_outdated` lines, each ending in a newline; empty when there is nothing to say
 */
export function formatUpdateNotices({
  availableUpdate,
  currentVersion,
  installKind,
  skills,
  wentAhead,
}: UpdateNoticesInput): string[] {
  if (availableUpdate !== null) {
    const news = `update_available: markdown-review ${availableUpdate.version} is out; this is ${currentVersion}.`;
    if (!wentAhead) {
      return [`${news} Tell the user, and offer to update once they say go ahead.\n`];
    }
    return [
      `${news} Ask the user whether to update. If they agree, ${describeUpdate(installKind, availableUpdate, skills)}\n`,
    ];
  }
  const when = wentAhead ? "Run" : "Once the user says go ahead, run";
  return skills
    .filter((skill) => isOlderThan(skill, currentVersion))
    .map(
      (skill) =>
        `skill_outdated: The markdown-review skill at ${skill.path} is older than this version (${currentVersion}). ` +
        `${when} \`${installSkillCommand(installKind, currentVersion, skill)}\`. The new skill loads in the next agent session.\n`
    );
}

function describeUpdate(
  installKind: InstallKind,
  { distTag, version }: NewerRelease,
  skills: readonly InstalledSkill[]
): string {
  const commands = [
    ...(installKind === "global" ? [globalInstallCommand(distTag)] : []),
    cliCommand(installKind, "stop", distTag),
    ...skills
      .filter((skill) => isOlderThan(skill, version))
      .map((skill) => installSkillCommand(installKind, distTag, skill)),
  ];
  const steps = `run ${commands.map((command) => `\`${command}\``).join(", then ")}`;
  return installKind === "npx"
    ? `${steps}, and from now on run markdown-review as \`${npxCommand(distTag)}\`.`
    : `${steps}.`;
}

function installSkillCommand(installKind: InstallKind, versionOrTag: string, skill: InstalledSkill): string {
  return cliCommand(installKind, skill.isGlobal ? "install-skill --global" : "install-skill", versionOrTag);
}

function isOlderThan(skill: InstalledSkill, version: string): boolean {
  return skill.version === null || (compareVersions(skill.version, version) ?? -1) < 0;
}
