import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { findRoot } from "./findRoot";
import { toRepositoryPath } from "./toRepositoryPath";

/**
 * What a path the agent named leads to
 *
 * - `file`: a file now, with its repo-relative POSIX path as the store records it and the real path of the root
 *   holding it
 * - `not-a-file`: something that exists and is not a file, such as a directory
 * - `missing`: nothing; `path` is the real path as far as it exists, with the rest as typed
 */
export type LocatedDocument =
  | { document: string; kind: "file"; root: string }
  | { kind: "not-a-file" }
  | { kind: "missing"; path: string };

/**
 * Finds the doc the agent named, the way `open` and `--document` both read it
 *
 * Symbolic links are resolved, and on a case-insensitive filesystem so is the case, so the path matches the one the
 * store records for the doc. A path that does not exist is resolved through its longest existing ancestor.
 *
 * @param workingDirectory the directory the command runs in
 * @param target the path the agent typed, which may be relative to the working directory
 * @throws CliError when the file is not inside the root it belongs to
 */
export async function locateDocument(workingDirectory: string, target: string): Promise<LocatedDocument> {
  const resolved = await resolveExistingPrefix(path.resolve(workingDirectory, target));
  const found = await stat(resolved).catch(() => null);
  if (found === null) {
    return { kind: "missing", path: resolved };
  }
  if (!found.isFile()) {
    return { kind: "not-a-file" };
  }
  const root = await findRoot(path.dirname(resolved), workingDirectory);
  return { document: toRepositoryPath(root, resolved), kind: "file", root };
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
