import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { findRoot } from "./findRoot";
import { toRepositoryPath } from "./toRepositoryPath";

/**
 * Finds an existing doc the agent named, the way `open` and `--document` both read it
 *
 * Symbolic links are resolved, and on a case-insensitive filesystem so is the case, so the path matches the one the
 * store records for the doc.
 *
 * @param workingDirectory the directory the command runs in
 * @param target the path the agent typed, which may be relative to the working directory
 * @returns the doc's repo-relative POSIX path and the real path of the root holding it, or null when the path is not a
 *   file
 * @throws CliError when the file is not inside the root it belongs to
 */
export async function locateDocument(
  workingDirectory: string,
  target: string
): Promise<{ document: string; root: string } | null> {
  const absolutePath = path.resolve(workingDirectory, target);
  const found = await stat(absolutePath).catch(() => null);
  if (found === null || !found.isFile()) {
    return null;
  }
  const root = await findRoot(path.dirname(absolutePath), workingDirectory);
  return { document: toRepositoryPath(root, await realpath(absolutePath)), root };
}
