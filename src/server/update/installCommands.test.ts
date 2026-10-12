import { describe, expect, test } from "vitest";

import { cliCommand, findInstallKind, installCommand } from "./installCommands";

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
    { expected: "npx @krelborn/markdown-review@latest stop", kind: "npx" },
  ] as const)("must run the command through $kind when installed that way", ({ expected, kind }) => {
    expect(cliCommand(kind, "stop")).toBe(expected);
  });

  test.each([
    { expected: "npm install --global @krelborn/markdown-review@latest", kind: "global" },
    { expected: "npx @krelborn/markdown-review@latest <command>", kind: "npx" },
  ] as const)("must give '$expected' as the way to update a $kind install", ({ expected, kind }) => {
    expect(installCommand(kind)).toBe(expected);
  });
});
