import type { Thread } from "../../shared/review/threadSchema";

/**
 * Which threads the comments list: those on the doc on screen and the review, or those on every doc
 */
export type ThreadView = "all" | "document";

export interface ThreadsInView {
  /**
   * How many threads each view lists
   */
  counts: Record<ThreadView, number>;

  /**
   * Whether the user can choose a view, which they can only when a thread is on a doc other than the one on screen
   */
  hasChoice: boolean;

  /**
   * Whether to head each doc's threads with its path, because the list holds more than one doc's
   */
  showsDocuments: boolean;

  threads: Thread[];

  /**
   * The view listed, which is This doc whenever there is no choice
   */
  view: ThreadView;
}

/**
 * Works out which threads the comments list
 *
 * @param threads every thread in the repo
 * @param documentPath the doc on screen, or null on the docs list, which lists every thread
 * @param chosen the view the user chose
 * @param editingThreadId the thread whose reply or draft is being written, which This doc lists wherever it is
 * @returns the threads to list, in the order given, and what the header needs to offer a choice
 */
export function threadsInView(
  threads: readonly Thread[],
  documentPath: string | null,
  chosen: ThreadView,
  editingThreadId: number | null
): ThreadsInView {
  if (documentPath === null) {
    return {
      counts: { all: threads.length, document: threads.length },
      hasChoice: false,
      showsDocuments: true,
      threads: [...threads],
      view: "all",
    };
  }
  const isOnDocument = ({ anchor }: Thread): boolean => anchor.kind === "review" || anchor.document === documentPath;
  const thisDocument = threads.filter((thread) => isOnDocument(thread) || thread.id === editingThreadId);
  const hasChoice = threads.some((thread) => !isOnDocument(thread));
  const view = hasChoice ? chosen : "document";
  const listed = view === "all" ? [...threads] : thisDocument;
  return {
    counts: { all: threads.length, document: thisDocument.length },
    hasChoice,
    showsDocuments: listed.some((thread) => !isOnDocument(thread)),
    threads: listed,
    view,
  };
}
