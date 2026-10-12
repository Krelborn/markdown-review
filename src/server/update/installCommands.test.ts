import { describe, expect, test } from "vitest";

import { cliCommand, findInstallKind, globalInstallCommand } from "./installCommands";

describe("installCommands", () => {
  test.each([
    { cliPath: "/Users/someone/.npm/_npx/0123abcd/node_modules/@krelborn/markdown-review/dist/cli.js", kind: "npx" },
    { cliPath: "/usr/local/lib/node_modules/@krelborn/markdown-review/dist/cli.js", kind: "global" },
    { cliPath: "/Users/someone/Code/markdown-review/dist/cli.js", kind: "global" },
  ])("must report $kind when the CLI runs from $cliPath", ({ cliPath, kind }) => {
    expect(findInstallKind(cliPath)).toBe(kind);
  });

  test.each([
    { expected: "markdown-review stop", kind: "global" },
    { expected: "npx @krelborn/markdown-review@next stop", kind: "npx" },
  ] as const)("must run the command through $kind when installed that way", ({ expected, kind }) => {
    expect(cliCommand(kind, "stop", "next")).toBe(expected);
  });

  test("must install the given dist-tag when it updates a global install", () => {
    expect(globalInstallCommand("next")).toBe("npm install --global @krelborn/markdown-review@next");
  });
});
