import { compareVersions, isPrerelease } from "./semanticVersions";
import type { DistTags } from "./updateCheckFileSchema";

export interface NewerRelease {
  /**
   * The dist-tag that names it, which the install commands use
   */
  distTag: keyof DistTags;

  version: string;
}

/**
 * Picks the published version to offer in place of the running one
 *
 * @param current the running version
 * @param distTags the registry's `latest` and `next` tags
 * @returns the version to offer and its dist-tag, or null when none is newer or a version cannot be read
 */
export function findAvailableUpdate(current: string, distTags: DistTags): NewerRelease | null {
  const distTagNames: (keyof DistTags)[] = isPrerelease(current) ? ["latest", "next"] : ["latest"];
  let best: NewerRelease | null = null;
  for (const distTag of distTagNames) {
    const version = distTags[distTag];
    if (version !== undefined && (compareVersions(version, best?.version ?? current) ?? 0) > 0) {
      best = { distTag, version };
    }
  }
  return best;
}
