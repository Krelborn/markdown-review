import { realpath } from "node:fs/promises";
import path from "node:path";

import { isRepositoryRelativePath } from "../../shared/review/isRepositoryRelativePath";

import { isFileNotFound } from "./isFileNotFound";

export type RepositoryPath =
  | { kind: "inside"; absolutePath: string }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "outside" };

/**
 * Finds a file in the repo from its repo-relative path
 *
 * @param root the repo root
 * @param relativePath a repo-relative POSIX path, e.g. "docs/plan.md"
 * @returns the file's real path when it is inside the repo; "outside" when it, or a symlink on the way, leads out of
 *   the repo; "missing" when nothing exists there; "invalid" when the path is not repo-relative
 */
export async function resolveRepositoryPath(root: string, relativePath: string): Promise<RepositoryPath> {
  if (!isRepositoryRelativePath(relativePath)) {
    return { kind: "invalid" };
  }
  let absolutePath: string;
  try {
    absolutePath = await realpath(path.join(root, ...relativePath.split("/")));
  } catch (error) {
    if (isFileNotFound(error) || isNotDirectory(error)) {
      return { kind: "missing" };
    }
    throw error;
  }
  const realRoot = await realpath(root);
  const isInside = absolutePath.startsWith(realRoot + path.sep);
  return isInside ? { absolutePath, kind: "inside" } : { kind: "outside" };
}

function isNotDirectory(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOTDIR";
}
