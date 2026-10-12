import { compareVersions, isPrerelease } from "./semanticVersions";
import type { DistTags } from "./updateCheckFileSchema";

/**
 * Picks the published version to offer in place of the running one
 *
 * @param current the running version
 * @param distTags the registry's `latest` and `next` tags
 * @returns the version to offer, or null when none is newer or a version cannot be read
 */
export function findAvailableUpdate(current: string, distTags: DistTags): string | null {
  const candidates = isPrerelease(current) ? [distTags.latest, distTags.next] : [distTags.latest];
  let best: string | null = null;
  for (const candidate of candidates) {
    if (candidate !== undefined && (compareVersions(candidate, best ?? current) ?? 0) > 0) {
      best = candidate;
    }
  }
  return best;
}
