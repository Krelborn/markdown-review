import { realpath } from "node:fs/promises";
import os from "node:os";

import skill from "../../skills/markdown-review/SKILL.md?raw";
import { packageVersion } from "../server/runtime/packageVersion";
import { findAvailableUpdate } from "../server/update/findAvailableUpdate";
import { findInstallKind } from "../server/update/installCommands";
import { readUpdateCheckFile } from "../server/update/readUpdateCheckFile";
import { updateCheckFilePath, updateChecksDisabled } from "../server/update/updateCheckSettings";

import type { CliContext } from "./CliContext";
import { findInstalledSkills } from "./findInstalledSkills";
import { formatUpdateNotices } from "./formatUpdateNotices";

/**
 * Works out what to tell the agent about a newer markdown-review and outdated copies of the skill, from the update
 * check cache and the installed skills, without contacting the registry
 *
 * @param context the CLI's path and environment
 * @param root the repo root, where a repo copy of the skill lives
 * @param approved whether the review is approved
 * @returns the notice lines, each ending in a newline
 */
export async function readUpdateNotices(
  { cliPath, terminal }: CliContext,
  root: string,
  approved: boolean
): Promise<string[]> {
  const { env } = terminal;
  const cached = updateChecksDisabled(env) ? null : await readUpdateCheckFile(updateCheckFilePath(env));
  const realCliPath = await realpath(cliPath).catch(() => cliPath);
  return formatUpdateNotices({
    approved,
    availableUpdate: findAvailableUpdate(packageVersion, cached?.distTags ?? {}),
    currentVersion: packageVersion,
    installKind: findInstallKind(realCliPath),
    skills: await findInstalledSkills(root, env.HOME ?? os.homedir(), skill),
  });
}
