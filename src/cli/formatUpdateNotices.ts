import type { NewerRelease } from "../server/update/findAvailableUpdate";
import type { InstallKind } from "../server/update/installCommands";
import { cliCommand, globalInstallCommand, npxCommand } from "../server/update/installCommands";
import { compareVersions } from "../server/update/semanticVersions";

import type { InstalledSkill } from "./findInstalledSkills";
import { skillDirectories } from "./skillDirectories";

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
 * The outdated copies of the skill in the repo, or in the home directory, and the command that reinstalls them
 */
interface SkillReinstall {
  command: string;
  paths: string[];
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
  return planSkillReinstalls(installKind, currentVersion, skills, currentVersion).map(
    ({ command, paths }) =>
      `skill_outdated: ${describeOutdated(paths)} older than this version (${currentVersion}). ` +
      `${when} \`${command}\`. The new skill loads in the next agent session.\n`
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
    ...planSkillReinstalls(installKind, distTag, skills, version).map(({ command }) => command),
  ];
  const steps = `run ${commands.map((command) => `\`${command}\``).join(", then ")}`;
  return installKind === "npx"
    ? `${steps}, and from now on run markdown-review as \`${npxCommand(distTag)}\`.`
    : `${steps}.`;
}

/**
 * @param installKind how markdown-review is installed
 * @param versionOrTag the version or dist-tag the commands run
 * @param skills the installed copies of the skill
 * @param version the version a copy is outdated against
 * @returns the reinstall for the repo, then for the home directory, leaving out either when no copy there is outdated;
 *   one that leaves a skills directory alone passes `--only`, so it rewrites just the outdated copy
 */
function planSkillReinstalls(
  installKind: InstallKind,
  versionOrTag: string,
  skills: readonly InstalledSkill[],
  version: string
): SkillReinstall[] {
  return [false, true].flatMap((isGlobal) => {
    const outdated = skills.filter((skill) => skill.isGlobal === isGlobal && isOlderThan(skill, version));
    const [first] = outdated;
    if (first === undefined) {
      return [];
    }
    const everyCopyIsOutdated = outdated.length === skillDirectories.length;
    const options = [...(isGlobal ? ["--global"] : []), ...(everyCopyIsOutdated ? [] : ["--only", first.directory])];
    return [
      {
        command: cliCommand(installKind, ["install-skill", ...options].join(" "), versionOrTag),
        paths: outdated.map((skill) => skill.path),
      },
    ];
  });
}

function describeOutdated(paths: readonly string[]): string {
  const at = paths.join(" and ");
  return paths.length === 1 ? `The markdown-review skill at ${at} is` : `The markdown-review skills at ${at} are`;
}

function isOlderThan(skill: InstalledSkill, version: string): boolean {
  return skill.version === null || (compareVersions(skill.version, version) ?? -1) < 0;
}
