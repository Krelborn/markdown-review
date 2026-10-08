import path from "node:path";

const storeDirectoryName = ".markdown-review";

export function storeDirectory(root: string): string {
  return path.join(root, storeDirectoryName);
}

export function reviewFilePath(root: string): string {
  return path.join(storeDirectory(root), "review.json");
}

export function serverFilePath(root: string): string {
  return path.join(storeDirectory(root), "server.json");
}

export function serverLockPath(root: string): string {
  return path.join(storeDirectory(root), "server.lock");
}

export function serverLogPath(root: string): string {
  return path.join(storeDirectory(root), "server.log");
}

export function documentsDirectory(root: string): string {
  return path.join(storeDirectory(root), "documents");
}

/**
 * Locates the file holding a doc's threads
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path, e.g. "docs/plan.md"
 * @returns where the doc's threads are stored, e.g. "<root>/.markdown-review/documents/docs/plan.md.json"
 */
export function documentThreadsFilePath(root: string, document: string): string {
  return path.join(documentsDirectory(root), ...`${document}.json`.split("/"));
}

/**
 * Locates a doc's source on disk
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path
 * @returns the doc's path on disk
 */
export function documentSourcePath(root: string, document: string): string {
  return path.join(root, ...document.split("/"));
}
