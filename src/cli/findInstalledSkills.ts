import { readTextFileOrNull } from "../server/files/readTextFileOrNull";

import { skillInstallPath } from "./skillInstallPath";

export interface InstalledSkill {
  /**
   * Whether this copy is the bundled skill, byte for byte
   */
  isCurrent: boolean;

  /**
   * Whether this copy is in the home directory rather than the repo
   */
  isGlobal: boolean;

  path: string;
}

/**
 * Finds the copies of the skill installed in the repo and in the home directory
 *
 * @param root the repo root
 * @param home the home directory
 * @param bundled the skill this CLI installs
 * @returns each installed copy, the repo's first; a copy that cannot be read counts as not installed
 */
export async function findInstalledSkills(root: string, home: string, bundled: string): Promise<InstalledSkill[]> {
  const locations = [
    { isGlobal: false, path: skillInstallPath(root) },
    { isGlobal: true, path: skillInstallPath(home) },
  ];
  const installed: InstalledSkill[] = [];
  for (const location of locations) {
    const contents = await readTextFileOrNull(location.path).catch(() => null);
    if (contents !== null) {
      installed.push({ ...location, isCurrent: contents === bundled });
    }
  }
  return installed;
}
