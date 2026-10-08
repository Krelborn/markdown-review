import path from "node:path";

import type { FSWatcher } from "chokidar";
import { watch } from "chokidar";

/**
 * Watches docs for edits, so connected tabs can be told as soon as the agent saves one
 */
export class DocumentWatcher {
  private readonly documents = new Map<string, string>();
  private readonly root: string;
  private readonly watcher: FSWatcher;

  /**
   * @param root the repo root
   * @param onChange called with a doc's repo-relative path when it is written, created or deleted
   */
  public constructor(root: string, onChange: (document: string) => void) {
    this.root = root;
    this.watcher = watch([], {
      atomic: true,
      awaitWriteFinish: { pollInterval: 20, stabilityThreshold: 50 },
      ignoreInitial: true,
    });
    this.watcher.on("all", (_event, changedPath) => {
      const document = this.documents.get(changedPath);
      if (document !== undefined) {
        onChange(document);
      }
    });
  }

  /**
   * @param document a repo-relative POSIX path; watching a doc twice has no further effect
   */
  public watch(document: string): void {
    const absolutePath = path.join(this.root, ...document.split("/"));
    if (!this.documents.has(absolutePath)) {
      this.documents.set(absolutePath, document);
      this.watcher.add(absolutePath);
    }
  }

  public close(): Promise<void> {
    return this.watcher.close();
  }
}
