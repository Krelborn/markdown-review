import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { findRoot } from "./findRoot";
import { toRepositoryPath } from "./toRepositoryPath";

export interface LocatedDocument {
  /**
   * The doc's repo-relative POSIX path, as the store records it
   */
  document: string;

  /**
   * Whether the path leads to a file now
   */
  exists: boolean;

  /**
   * The real path of the root holding the doc
   */
  root: string;
}

/**
 * Finds the doc the agent named, the way `open` and `--document` both read it
 *
 * Symbolic links are resolved, and on a case-insensitive filesystem so is the case, so the path matches the one the
 * store records for the doc. A doc that does not exist is resolved as far as its folders do, which are those of the
 * working directory's root.
 *
 * @param workingDirectory the directory the command runs in
 * @param target the path the agent typed, which may be relative to the working directory
 * @throws CliError when the path is not inside the root it belongs to
 */
export async function locateDocument(workingDirectory: string, target: string): Promise<LocatedDocument> {
  const resolved = await resolveExistingPrefix(path.resolve(workingDirectory, target));
  const exists = (await stat(resolved).catch(() => null))?.isFile() ?? false;
  const root = exists ? await findRoot(path.dirname(resolved), workingDirectory) : await findRoot(workingDirectory);
  return { document: toRepositoryPath(root, resolved), exists, root };
}

/**
 * Resolves the longest part of a path that exists, and appends the rest as typed
 */
async function resolveExistingPrefix(absolutePath: string): Promise<string> {
  const missing: string[] = [];
  let existing = absolutePath;
  for (;;) {
    const real = await realpath(existing).catch(() => null);
    if (real !== null) {
      return path.join(real, ...missing);
    }
    const parent = path.dirname(existing);
    if (parent === existing) {
      return absolutePath;
    }
    missing.unshift(path.basename(existing));
    existing = parent;
  }
}
