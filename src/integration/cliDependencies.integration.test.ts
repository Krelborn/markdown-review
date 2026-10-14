import { readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";

import { expect, test } from "vitest";

import packageJson from "../../package.json" with { type: "json" };

test("must import only Node's modules and the package's dependencies when the CLI is built", async () => {
  const cli = await readFile(new URL("../../dist/cli.js", import.meta.url), "utf8");

  const packages = readImportedPackages(cli);

  expect(packages).not.toEqual([]);
  expect(packages.filter((name) => !Object.hasOwn(packageJson.dependencies, name))).toEqual([]);
});

/**
 * @param bundle the built CLI
 * @returns the packages the bundle imports at run time, other than Node's built-in modules
 */
function readImportedPackages(bundle: string): string[] {
  const specifiers = [...bundle.matchAll(/^import\s(?:[^"]*\sfrom\s)?"([^"]+)"|\bimport\("([^"]+)"\)/gmu)].map(
    ([, staticSpecifier, dynamicSpecifier]) => staticSpecifier ?? dynamicSpecifier ?? ""
  );
  const packages = specifiers
    .filter((specifier) => !isBuiltin(specifier) && !specifier.startsWith("."))
    .map((specifier) =>
      specifier
        .split("/")
        .slice(0, specifier.startsWith("@") ? 2 : 1)
        .join("/")
    );
  return [...new Set(packages)];
}
