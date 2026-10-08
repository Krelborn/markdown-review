import type { Verdict } from "../../shared/api/apiRequestSchemas";
import type { DocumentList, DocumentSource, ThreadsSnapshot } from "../../shared/api/apiResponseSchemas";
import type { NewThread } from "../../shared/review/newThreadSchema";

import type { ReviewEvent } from "./reviewEventSchema";

/**
 * The review server as the browser sees it; each method rejects with a `ReviewApiError` when the server refuses
 */
export interface ReviewApi {
  createThread(newThread: NewThread): Promise<void>;
  deleteDraft(id: number): Promise<void>;
  readDocument(document: string): Promise<DocumentSource>;
  readDocuments(): Promise<DocumentList>;

  /**
   * Reads every thread in the repo, with the review's state
   */
  readThreads(): Promise<ThreadsSnapshot>;

  resolveThread(id: number): Promise<void>;
  submit(verdict: Verdict): Promise<void>;

  /**
   * Listens to the server's events until the returned function is called
   */
  subscribe(listener: (event: ReviewEvent) => void): () => void;

  writeDraft(id: number, body: string): Promise<void>;
}
