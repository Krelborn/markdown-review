import type { Thread } from "../../shared/review/threadSchema";

/**
 * The threads of one store file
 */
export interface StoredThreads {
  /**
   * The doc the file belongs to, or null for `review.json`
   */
  document: string | null;

  threads: Thread[];
}
