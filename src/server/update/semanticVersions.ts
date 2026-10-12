const versionPattern =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

interface ParsedVersion {
  release: [number, number, number];
  prerelease: string[];
}

/**
 * Orders two semantic versions by semver precedence
 *
 * @param left a version such as "0.4.0" or "0.4.0-beta.1"
 * @param right another version
 * @returns a negative number when `left` comes first, a positive number when `right` does, 0 when they are equal,
 *   and null when either is not a semantic version
 */
export function compareVersions(left: string, right: string): number | null {
  const parsedLeft = parseVersion(left);
  const parsedRight = parseVersion(right);
  if (parsedLeft === null || parsedRight === null) {
    return null;
  }
  const [leftMajor, leftMinor, leftPatch] = parsedLeft.release;
  const [rightMajor, rightMinor, rightPatch] = parsedRight.release;
  return (
    leftMajor - rightMajor ||
    leftMinor - rightMinor ||
    leftPatch - rightPatch ||
    comparePrereleases(parsedLeft.prerelease, parsedRight.prerelease)
  );
}

/**
 * @param version a version such as "0.4.0-beta.1"
 * @returns whether it is a semantic version with a pre-release part
 */
export function isPrerelease(version: string): boolean {
  return (parseVersion(version)?.prerelease.length ?? 0) > 0;
}

function parseVersion(version: string): ParsedVersion | null {
  const groups = versionPattern.exec(version)?.groups;
  if (groups === undefined) {
    return null;
  }
  return {
    prerelease: groups.prerelease?.split(".") ?? [],
    release: [Number(groups.major), Number(groups.minor), Number(groups.patch)],
  };
}

function comparePrereleases(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return right.length - left.length;
  }
  for (const [i, leftIdentifier] of left.entries()) {
    const rightIdentifier = right[i];
    if (rightIdentifier === undefined) {
      break;
    }
    const difference = compareIdentifiers(leftIdentifier, rightIdentifier);
    if (difference !== 0) {
      return difference;
    }
  }
  return left.length - right.length;
}

function compareIdentifiers(left: string, right: string): number {
  const leftIsNumeric = /^\d+$/u.test(left);
  const rightIsNumeric = /^\d+$/u.test(right);
  if (leftIsNumeric && rightIsNumeric) {
    return Number(left) - Number(right);
  }
  if (leftIsNumeric !== rightIsNumeric) {
    return leftIsNumeric ? -1 : 1;
  }
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}
