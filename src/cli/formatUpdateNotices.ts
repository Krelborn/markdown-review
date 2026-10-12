import type { InstallKind } from "../server/update/installCommands";
import { cliCommand, globalInstallCommand } from "../server/update/installCommands";

import type { InstalledSkill } from "./findInstalledSkills";

export interface UpdateNoticesInput {
  /**
   * Whether the review is approved, which is when the agent should act on the notices
   */
  approved: boolean;

  /**
   * The newer version on npm, or null when none is known
   */
  availableUpdate: string | null;

  currentVersion: string;
  installKind: InstallKind;
  skills: readonly InstalledSkill[];
}

/**
 * Describes a newer markdown-review and outdated copies of the skill for the agent
 *
 * @returns the `update_available` and `skill_outdated` lines, each ending in a newline; empty when there is nothing to say
 */
export function formatUpdateNotices({
  approved,
  availableUpdate,
  currentVersion,
  installKind,
  skills,
}: UpdateNoticesInput): string[] {
  if (availableUpdate !== null) {
    const news = `update_available: markdown-review ${availableUpdate} is out; this is ${currentVersion}.`;
    if (!approved) {
      return [`${news} Tell the user, and offer to update once they approve the review.\n`];
    }
    return [`${news} Ask the user whether to update. If they agree, ${describeUpdate(installKind, skills)}\n`];
  }
  const when = approved ? "Run" : "Once the user approves the review, run";
  return skills
    .filter((skill) => !skill.isCurrent)
    .map(
      (skill) =>
        `skill_outdated: The markdown-review skill at ${skill.path} is older than this version (${currentVersion}). ` +
        `${when} \`${installSkillCommand(installKind, skill)}\`. The new skill loads in the next agent session.\n`
    );
}

function describeUpdate(installKind: InstallKind, skills: readonly InstalledSkill[]): string {
  const commands = [
    ...(installKind === "global" ? [globalInstallCommand] : []),
    cliCommand(installKind, "stop"),
    ...skills.map((skill) => installSkillCommand(installKind, skill)),
  ];
  const steps = `run ${commands.map((command) => `\`${command}\``).join(", then ")}`;
  return installKind === "npx"
    ? `${steps}, and from now on run markdown-review as \`npx @krelborn/markdown-review@latest\`.`
    : `${steps}.`;
}

function installSkillCommand(installKind: InstallKind, skill: InstalledSkill): string {
  return cliCommand(installKind, skill.isGlobal ? "install-skill --global" : "install-skill");
}
