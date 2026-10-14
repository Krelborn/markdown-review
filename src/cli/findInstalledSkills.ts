import { readTextFileOrNull } from "../server/files/readTextFileOrNull";

import type { SkillDirectory } from "./skillDirectories";
import { skillDirectories, skillInstallPath } from "./skillDirectories";
import { readSkillStamp } from "./skillStamps";

export interface InstalledSkill {
  /**
   * The skills directory this copy is in
   */
  directory: SkillDirectory;

  /**
   * Whether this copy is in the home directory rather than the repo
   */
  isGlobal: boolean;

  path: string;

  /**
   * The version that installed this copy, or null when it carries none
   */
  version: string | null;
}

/**
 * Finds the copies of the skill installed in each skills directory of the repo and of the home directory
 *
 * @param root the repo root
 * @param home the home directory
 * @returns each installed copy, the repo's first; a copy that cannot be read counts as not installed
 */
export async function findInstalledSkills(root: string, home: string): Promise<InstalledSkill[]> {
  const locations = [
    { base: root, isGlobal: false },
    { base: home, isGlobal: true },
  ].flatMap(({ base, isGlobal }) =>
    skillDirectories.map((directory) => ({ directory, isGlobal, path: skillInstallPath(base, directory) }))
  );
  const installed: InstalledSkill[] = [];
  for (const location of locations) {
    const contents = await readTextFileOrNull(location.path).catch(() => null);
    if (contents !== null) {
      installed.push({ ...location, version: readSkillStamp(contents) });
    }
  }
  return installed;
}
