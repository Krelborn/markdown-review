import type { Thread } from "../../shared/review/threadSchema";

import type { StoredThreads } from "./StoredThreads";

export interface Renumbering {
  document: string | null;
  from: number;
  to: number;
}

export interface RenumberResult {
  files: StoredThreads[];
  renumberings: Renumbering[];
}

/**
 * Gives every thread a unique ID after a merge has brought in threads that share one
 *
 * @param files the threads of every store file
 * @returns the files with the later-created thread of each clash moved to the next free ID, and what was moved
 */
export function renumberDuplicateThreads(files: readonly StoredThreads[]): RenumberResult {
  const entries = files.flatMap((file, fileIndex) => file.threads.map((thread) => ({ fileIndex, thread })));
  entries.sort(
    (left, right) =>
      left.thread.id - right.thread.id ||
      Date.parse(left.thread.createdAt) - Date.parse(right.thread.createdAt) ||
      left.fileIndex - right.fileIndex
  );
  let nextId = Math.max(0, ...entries.map(({ thread }) => thread.id)) + 1;
  const newIds = new Map<Thread, number>();
  entries.forEach(({ thread }, index) => {
    if (entries[index - 1]?.thread.id === thread.id) {
      newIds.set(thread, nextId);
      nextId += 1;
    }
  });
  const renumberings: Renumbering[] = [];
  const renumbered = files.map((file) => ({
    ...file,
    threads: file.threads.map((thread) => {
      const to = newIds.get(thread);
      if (to === undefined) {
        return thread;
      }
      renumberings.push({ document: file.document, from: thread.id, to });
      return { ...thread, id: to };
    }),
  }));
  return { files: renumbered, renumberings };
}
