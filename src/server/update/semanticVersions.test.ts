import { describe, expect, test } from "vitest";

import { compareVersions, isPrerelease } from "./semanticVersions";

describe("semanticVersions", () => {
  test.each([
    { higher: "1.0.0", lower: "0.9.9" },
    { higher: "0.10.0", lower: "0.9.0" },
    { higher: "0.3.1", lower: "0.3.0" },
    { higher: "1.0.0", lower: "1.0.0-rc.1" },
    { higher: "1.0.0-beta", lower: "1.0.0-alpha" },
    { higher: "1.0.0-beta.11", lower: "1.0.0-beta.2" },
    { higher: "1.0.0-beta.a", lower: "1.0.0-beta.2" },
    { higher: "1.0.0-beta.1", lower: "1.0.0-beta" },
  ])("must order $higher after $lower", ({ higher, lower }) => {
    expect(compareVersions(higher, lower)).toBeGreaterThan(0);
    expect(compareVersions(lower, higher)).toBeLessThan(0);
  });

  test("must treat versions that differ only in build metadata as equal", () => {
    expect(compareVersions("1.2.3+build.1", "1.2.3+build.2")).toBe(0);
  });

  test.each(["1.2", "v1.2.3", "1.2.3-", "01.2.3", "latest", ""])(
    "must return null when '%s' is not a version",
    (version) => {
      expect(compareVersions(version, "1.2.3")).toBeNull();
      expect(compareVersions("1.2.3", version)).toBeNull();
    }
  );

  test.each([
    { prerelease: true, version: "0.4.0-beta.1" },
    { prerelease: false, version: "0.4.0" },
    { prerelease: false, version: "0.4.0+build-1" },
    { prerelease: false, version: "nonsense" },
  ])("must report $prerelease for whether $version is a pre-release", ({ prerelease, version }) => {
    expect(isPrerelease(version)).toBe(prerelease);
  });
});
