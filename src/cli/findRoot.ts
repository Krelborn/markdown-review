import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";

const runCommand = promisify(execFile);

/**
 * Finds the root a directory's reviews belong to
 *
 * @param directory an existing directory
 * @param outsideGitDirectory the root to use when `directory` is not in a git repository; `directory` itself unless
 *   given
 * @returns the real path of the git repository (or worktree) root holding the directory, or of `outsideGitDirectory`
 *   when it is not in a git repository
 */
export async function findRoot(directory: string, outsideGitDirectory = directory): Promise<string> {
  try {
    const { stdout } = await runCommand("git", ["rev-parse", "--show-toplevel"], { cwd: directory });
    return await realpath(stdout.trim());
  } catch {
    return realpath(outsideGitDirectory);
  }
}
