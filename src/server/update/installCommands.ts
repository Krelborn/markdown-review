import path from "node:path";

/**
 * How the running markdown-review was installed: globally by a package manager, or unpacked by npx
 */
export type InstallKind = "global" | "npx";

const npxCommand = "npx @krelborn/markdown-review@latest";

/**
 * @param cliPath the real path of the running `dist/cli.js`
 * @returns how that copy of markdown-review was installed
 */
export function findInstallKind(cliPath: string): InstallKind {
  return cliPath.split(path.sep).includes("_npx") ? "npx" : "global";
}

/**
 * @param kind how markdown-review is installed
 * @param args the command and its arguments, e.g. "install-skill --global"
 * @returns the shell command that runs the latest markdown-review with those arguments
 */
export function cliCommand(kind: InstallKind, args: string): string {
  return `${kind === "npx" ? npxCommand : "markdown-review"} ${args}`;
}

/**
 * The shell command that updates a global install to the latest version
 */
export const globalInstallCommand = "npm install --global @krelborn/markdown-review@latest";
