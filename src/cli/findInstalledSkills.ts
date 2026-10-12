import { readTextFileOrNull } from "../server/files/readTextFileOrNull";
import { compareVersions } from "../server/update/semanticVersions";

import { skillInstallPath } from "./skillInstallPath";
import { readSkillStamp } from "./skillStamps";

export interface InstalledSkill {
  /**
   * Whether this copy was installed by the running version or a newer one
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
 * @param version the running markdown-review's version
 * @returns each installed copy, the repo's first; a copy that cannot be read counts as not installed, and one with no
 *   readable version stamp counts as older
 */
export async function findInstalledSkills(root: string, home: string, version: string): Promise<InstalledSkill[]> {
  const locations = [
    { isGlobal: false, path: skillInstallPath(root) },
    { isGlobal: true, path: skillInstallPath(home) },
  ];
  const installed: InstalledSkill[] = [];
  for (const location of locations) {
    const contents = await readTextFileOrNull(location.path).catch(() => null);
    if (contents !== null) {
      installed.push({ ...location, isCurrent: isFromVersionOrNewer(contents, version) });
    }
  }
  return installed;
}

function isFromVersionOrNewer(contents: string, version: string): boolean {
  const stamp = readSkillStamp(contents);
  if (stamp === null) {
    return false;
  }
  return (compareVersions(stamp, version) ?? -1) >= 0;
}
