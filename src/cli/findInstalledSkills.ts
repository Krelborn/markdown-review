import { readTextFileOrNull } from "../server/files/readTextFileOrNull";

import { skillInstallPath } from "./skillInstallPath";
import { readSkillStamp } from "./skillStamps";

export interface InstalledSkill {
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
 * Finds the copies of the skill installed in the repo and in the home directory
 *
 * @param root the repo root
 * @param home the home directory
 * @returns each installed copy, the repo's first; a copy that cannot be read counts as not installed
 */
export async function findInstalledSkills(root: string, home: string): Promise<InstalledSkill[]> {
  const locations = [
    { isGlobal: false, path: skillInstallPath(root) },
    { isGlobal: true, path: skillInstallPath(home) },
  ];
  const installed: InstalledSkill[] = [];
  for (const location of locations) {
    const contents = await readTextFileOrNull(location.path).catch(() => null);
    if (contents !== null) {
      installed.push({ ...location, version: readSkillStamp(contents) });
    }
  }
  return installed;
}
