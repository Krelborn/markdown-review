import path from "node:path";

/**
 * How the running markdown-review was installed: globally by a package manager, or unpacked by npx
 */
export type InstallKind = "global" | "npx";

/**
 * @param cliPath the real path of the running `dist/cli.js`
 * @returns how that copy of markdown-review was installed
 */
export function findInstallKind(cliPath: string): InstallKind {
  return cliPath.split(path.sep).includes("_npx") ? "npx" : "global";
}

/**
 * @param versionOrTag the version or dist-tag to run, e.g. "latest" or "0.4.0"
 * @returns the npx command that runs that markdown-review
 */
export function npxCommand(versionOrTag: string): string {
  return `npx @krelborn/markdown-review@${versionOrTag}`;
}

/**
 * @param kind how markdown-review is installed
 * @param args the command and its arguments, e.g. "install-skill --global"
 * @param versionOrTag for npx, the version or dist-tag to run; a global install runs whichever is installed
 * @returns the shell command that runs markdown-review with those arguments
 */
export function cliCommand(kind: InstallKind, args: string, versionOrTag: string): string {
  return `${kind === "npx" ? npxCommand(versionOrTag) : "markdown-review"} ${args}`;
}

/**
 * @param distTag the dist-tag to install, e.g. "latest"
 * @returns the shell command that updates a global install to that dist-tag's version
 */
export function globalInstallCommand(distTag: string): string {
  return `npm install --global @krelborn/markdown-review@${distTag}`;
}

/**
 * @param distTag the dist-tag to install, e.g. "latest"
 * @param root the repo whose review server is running the old version
 * @returns a POSIX shell command that updates a global install, then stops that repo's server from wherever it is run
 */
export function globalUpdateCommand(distTag: string, root: string): string {
  return `${globalInstallCommand(distTag)} && (cd ${quoteForShell(root)} && markdown-review stop)`;
}

function quoteForShell(text: string): string {
  return `'${text.replaceAll("'", "'\\''")}'`;
}
