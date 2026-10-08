import { realpath } from "node:fs/promises";
import path from "node:path";

import { isRepositoryRelativePath } from "../../shared/review/isRepositoryRelativePath";
import { storeDirectory } from "../store/storePaths";

import { isFileNotFound } from "./isFileNotFound";

export type RepositoryPath =
  | { kind: "inside"; absolutePath: string }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "outside" }
  | { kind: "private" };

/**
 * Finds a file in the repo from its repo-relative path
 *
 * @param root the repo root
 * @param relativePath a repo-relative POSIX path, e.g. "docs/plan.md"
 * @returns the file's real path when it is inside the repo; "outside" when it, or a symlink on the way, leads out of
 *   the repo; "private" when it, or a symlink on the way, leads into `.markdown-review/`, which holds the server's
 *   token; "missing" when nothing exists there; "invalid" when the path is not repo-relative
 */
export async function resolveRepositoryPath(root: string, relativePath: string): Promise<RepositoryPath> {
  if (!isRepositoryRelativePath(relativePath)) {
    return { kind: "invalid" };
  }
  const joinedPath = path.join(root, ...relativePath.split("/"));
  if (isInDirectory(joinedPath, storeDirectory(root))) {
    return { kind: "private" };
  }
  let absolutePath: string;
  try {
    absolutePath = await realpath(joinedPath);
  } catch (error) {
    if (isFileNotFound(error) || isNotDirectory(error)) {
      return { kind: "missing" };
    }
    throw error;
  }
  const realRoot = await realpath(root);
  if (!absolutePath.startsWith(realRoot + path.sep)) {
    return { kind: "outside" };
  }
  return isInDirectory(absolutePath, storeDirectory(realRoot)) ? { kind: "private" } : { absolutePath, kind: "inside" };
}

function isInDirectory(filePath: string, directory: string): boolean {
  return filePath === directory || filePath.startsWith(directory + path.sep);
}

function isNotDirectory(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOTDIR";
}
