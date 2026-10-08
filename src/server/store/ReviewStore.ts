import type { Anchor } from "../../shared/review/anchorSchema";
import { documentPathSchema } from "../../shared/review/anchorSchema";
import type { DocumentThreadsFile } from "../../shared/review/documentThreadsFileSchema";
import type { NewThread } from "../../shared/review/newThreadSchema";
import { newThreadSchema } from "../../shared/review/newThreadSchema";
import type { ReviewFile } from "../../shared/review/reviewFileSchema";
import type { ReviewState } from "../../shared/review/ReviewState";
import { storeFileVersion } from "../../shared/review/storeFileVersion";
import type { Thread } from "../../shared/review/threadSchema";
import { messageBodySchema } from "../../shared/review/threadSchema";
import { anchorNewPassage } from "../anchoring/anchorNewPassage";
import { reanchorDocumentThreads } from "../anchoring/reanchorDocumentThreads";
import type { Logger } from "../logging/Logger";

import { emptyReviewFile } from "./emptyReviewFile";
import { hashSource } from "./hashSource";
import { needsAgent } from "./needsAgent";
import { OperationQueue } from "./OperationQueue";
import { parseStoreInput } from "./parseStoreInput";
import { renumberDuplicateThreads } from "./renumberDuplicateThreads";
import { StoreError } from "./StoreError";
import type { StoredThreads } from "./StoredThreads";
import type { StoreFileResult } from "./StoreFileResult";
import { StoreFiles } from "./StoreFiles";
import {
  createDraftThread,
  deleteDraft,
  replyAsAgent,
  resolveAsAgent,
  resolveAsUser,
  submitDraft,
  writeDraft,
} from "./threadTransitions";
import { toReviewState } from "./toReviewState";

export type Verdict = "request-changes" | "approve";

export interface ThreadsSnapshot {
  review: ReviewState;
  threads: Thread[];

  /**
   * Store files that could not be read, and so were left out
   */
  problems: string[];
}

export interface SubmitResult {
  review: ReviewState;
  submittedThreadIds: number[];
}

type Actor = "user" | "agent";

/**
 * Holds one root's review threads and carries out every change to them, one at a time
 */
export class ReviewStore {
  private readonly files: StoreFiles;
  private readonly logger: Logger;
  private readonly queue: OperationQueue = new OperationQueue();

  /**
   * @param root the repo root whose `.markdown-review/` directory holds the threads
   * @param logger where store files that cannot be read, and repairs to the store, are reported
   */
  public constructor(root: string, logger: Logger) {
    this.files = new StoreFiles(root);
    this.logger = logger;
  }

  /**
   * Creates the store directory if needed and gives threads that share an ID, after a merge, unique IDs
   */
  public initialize(): Promise<void> {
    return this.queue.enqueue(async () => {
      await this.files.ensureStoreDirectory();
      const { files, problems } = await this.readAllStoredThreads();
      problems.forEach((problem) => this.logger.warn(problem));
      const { files: renumbered, renumberings } = renumberDuplicateThreads(files);
      const changedDocuments = new Set(renumberings.map(({ document }) => document));
      for (const { document, threads } of renumbered) {
        if (changedDocuments.has(document)) {
          await this.replaceThreads(document, threads);
        }
      }
      for (const { document, from, to } of renumberings) {
        this.logger.info(
          `Thread #${from} in ${document ?? "the review"} was renumbered to #${to} because its ID was taken`
        );
      }
    });
  }

  /**
   * Starts a review round, so an earlier approval no longer counts
   *
   * @returns the review state after the request
   */
  public requestReview(): Promise<ReviewState> {
    return this.queue.enqueue(async () => {
      const review = requireValid(await this.files.readReviewFile());
      const next = { ...review, requestedAt: new Date().toISOString() };
      await this.files.writeReviewFile(next);
      return toReviewState(next);
    });
  }

  /**
   * Saves a new comment as a draft thread
   *
   * @param newThread the comment and what it is on
   * @returns the draft thread
   * @throws StoreError "invalid-input" when the comment is malformed, or "missing-document" when its doc does not exist
   */
  public createDraftThread(newThread: NewThread): Promise<Thread> {
    return this.queue.enqueue(async () => {
      const { anchor, body, renderedHash } = parseStoreInput(newThreadSchema, newThread, "The new thread");
      const at = new Date().toISOString();
      const id = await this.nextThreadId();
      if (anchor.kind === "review") {
        const review = requireValid(await this.files.readReviewFile());
        const thread = createDraftThread(id, anchor, body, at);
        await this.files.writeReviewFile({ ...review, threads: [...review.threads, thread] });
        return thread;
      }
      const { file, source } = await this.readCurrentDocumentFile(anchor.document);
      if (source === null) {
        throw new StoreError("missing-document", `${anchor.document} does not exist`);
      }
      const threadAnchor: Anchor = anchor.kind === "document" ? anchor : anchorNewPassage(anchor, source, renderedHash);
      const thread = createDraftThread(id, threadAnchor, body, at);
      await this.files.writeDocumentFile({ ...file, threads: [...file.threads, thread] });
      return thread;
    });
  }

  /**
   * Sets the user's unsubmitted comment or reply on a thread
   *
   * @throws StoreError "unknown-thread" when no thread has the ID, or "invalid-input" when the text is blank
   */
  public writeDraft(id: number, body: string): Promise<Thread> {
    return this.changeThread(id, "user", (thread, at) =>
      writeDraft(thread, parseStoreInput(messageBodySchema, body, "The draft"), at)
    );
  }

  /**
   * Discards the user's unsubmitted comment or reply on a thread
   *
   * @returns the thread without its draft, or null when it was a draft thread and has been deleted
   * @throws StoreError "unknown-thread", or "invalid-state" when the thread has no draft
   */
  public deleteDraft(id: number): Promise<Thread | null> {
    return this.changeThread(id, "user", deleteDraft);
  }

  /**
   * @throws StoreError "unknown-thread", or "invalid-state" when the thread is a draft
   */
  public resolveAsUser(id: number): Promise<Thread> {
    return this.changeThread(id, "user", resolveAsUser);
  }

  /**
   * Submits every draft in the repo and records the user's verdict on the review round
   *
   * @param verdict "approve" ends the round; "request-changes" needs at least one draft
   * @returns the IDs of the threads that received a submitted message, and the review state after the submit
   * @throws StoreError "invalid-state" when requesting changes with no drafts
   */
  public submit(verdict: Verdict): Promise<SubmitResult> {
    return this.queue.enqueue(async () => {
      const at = new Date().toISOString();
      const review = requireValid(await this.files.readReviewFile());
      const documentFiles = await this.readDocumentFilesWithDrafts();
      const submittedThreadIds = [...review.threads, ...documentFiles.flatMap((file) => file.threads)]
        .filter((thread) => thread.draft !== undefined)
        .map((thread) => thread.id)
        .sort((left, right) => left - right);
      if (verdict === "request-changes" && submittedThreadIds.length === 0) {
        throw new StoreError("invalid-state", "There are no drafts to submit");
      }
      for (const file of documentFiles) {
        await this.files.writeDocumentFile({ ...file, threads: file.threads.map((thread) => submitDraft(thread, at)) });
      }
      const next: ReviewFile = {
        ...review,
        approvedAt: verdict === "approve" ? at : null,
        threads: review.threads.map((thread) => submitDraft(thread, at)),
      };
      await this.files.writeReviewFile(next);
      return { review: toReviewState(next), submittedThreadIds };
    });
  }

  /**
   * @throws StoreError "unknown-thread" when no thread has the ID or the thread is a draft, or "invalid-input" when
   *   the reply is blank
   */
  public replyAsAgent(id: number, body: string): Promise<Thread> {
    return this.changeThread(id, "agent", (thread, at) =>
      replyAsAgent(thread, parseStoreInput(messageBodySchema, body, "The reply"), at)
    );
  }

  /**
   * @param body what the agent changed, or null to resolve without a message
   * @throws StoreError "unknown-thread" when no thread has the ID or the thread is a draft, or "invalid-input" when
   *   the message is blank
   */
  public resolveAsAgent(id: number, body: string | null): Promise<Thread> {
    return this.changeThread(id, "agent", (thread, at) =>
      resolveAsAgent(thread, body === null ? null : parseStoreInput(messageBodySchema, body, "The message"), at)
    );
  }

  /**
   * Reads threads for the browser, first re-anchoring any doc that changed since its threads were last anchored
   *
   * @param document the doc whose threads to read, alongside the review's, or null for every thread
   * @returns the review state, the threads in ID order, and any store files that could not be read
   * @throws StoreError "invalid-input" when the doc path is not a repo-relative POSIX path
   */
  public readThreads(document: string | null): Promise<ThreadsSnapshot> {
    return this.queue.enqueue(() => this.readSnapshot(document));
  }

  /**
   * Reads what the agent has to act on, first re-anchoring any doc that changed since its threads were last anchored
   *
   * @param document the doc to limit the threads to, or null for every thread including the review's
   * @returns the review state and the threads that need the agent
   * @throws StoreError "invalid-input" when the doc path is not a repo-relative POSIX path
   */
  public readInbox(document: string | null): Promise<ThreadsSnapshot> {
    return this.queue.enqueue(async () => {
      const snapshot = await this.readSnapshot(document);
      const threads = snapshot.threads.filter(
        (thread) => needsAgent(thread) && (document === null || thread.anchor.kind !== "review")
      );
      return { ...snapshot, threads };
    });
  }

  private async readSnapshot(document: string | null): Promise<ThreadsSnapshot> {
    const documents =
      document === null
        ? await this.files.listDocuments()
        : [parseStoreInput(documentPathSchema, document, "The doc path")];
    const problems: string[] = [];
    const review = await this.readReviewFileOrReport(problems);
    const threads = [...review.threads];
    for (const name of documents) {
      threads.push(...(await this.readDocumentThreadsOrReport(name, problems)));
    }
    return { problems, review: toReviewState(review), threads: threads.sort((left, right) => left.id - right.id) };
  }

  private async readReviewFileOrReport(problems: string[]): Promise<ReviewFile> {
    const result = await this.files.readReviewFile();
    if (result.kind === "invalid") {
      problems.push(result.problem);
      return emptyReviewFile;
    }
    return result.value;
  }

  private async readDocumentThreadsOrReport(document: string, problems: string[]): Promise<Thread[]> {
    try {
      return (await this.readCurrentDocumentFile(document)).file.threads;
    } catch (error) {
      if (error instanceof StoreError && error.reason === "invalid-file") {
        problems.push(error.message);
        return [];
      }
      throw error;
    }
  }

  private changeThread<Result extends Thread | null>(
    id: number,
    actor: Actor,
    change: (thread: Thread, at: string) => Result
  ): Promise<Result> {
    return this.queue.enqueue(async () => {
      const document = await this.locateThread(id);
      const threads =
        document === null
          ? requireValid(await this.files.readReviewFile()).threads
          : (await this.readCurrentDocumentFile(document)).file.threads;
      const thread = threads.find((candidate) => candidate.id === id);
      if (thread === undefined || (actor === "agent" && thread.status === "draft")) {
        throw new StoreError("unknown-thread", `No thread #${id}`);
      }
      const changed = change(thread, new Date().toISOString());
      await this.replaceThreads(document, replaceThread(threads, id, changed));
      return changed;
    });
  }

  /**
   * @returns the doc whose threads file holds the thread, or null when `review.json` does
   * @throws StoreError "unknown-thread" when no readable store file holds it
   */
  private async locateThread(id: number): Promise<string | null> {
    const { files } = await this.readAllStoredThreads();
    const file = files.find((candidate) => candidate.threads.some((thread) => thread.id === id));
    if (file === undefined) {
      throw new StoreError("unknown-thread", `No thread #${id}`);
    }
    return file.document;
  }

  private async nextThreadId(): Promise<number> {
    const { files } = await this.readAllStoredThreads();
    return Math.max(0, ...files.flatMap((file) => file.threads.map((thread) => thread.id))) + 1;
  }

  private async readAllStoredThreads(): Promise<{ files: StoredThreads[]; problems: string[] }> {
    const files: StoredThreads[] = [];
    const problems: string[] = [];
    const review = await this.files.readReviewFile();
    if (review.kind === "valid") {
      files.push({ document: null, threads: review.value.threads });
    } else {
      problems.push(review.problem);
    }
    for (const document of await this.files.listDocuments()) {
      const result = await this.files.readDocumentFile(document);
      if (result.kind === "invalid") {
        problems.push(result.problem);
      } else if (result.value !== null) {
        files.push({ document, threads: result.value.threads });
      }
    }
    return { files, problems };
  }

  private async readDocumentFilesWithDrafts(): Promise<DocumentThreadsFile[]> {
    const files: DocumentThreadsFile[] = [];
    for (const document of await this.files.listDocuments()) {
      const result = await this.files.readDocumentFile(document);
      if (result.kind === "invalid") {
        this.logger.warn(`Drafts in ${document} were not submitted. ${result.problem}`);
      } else if (result.value?.threads.some((thread) => thread.draft !== undefined)) {
        files.push((await this.readCurrentDocumentFile(document)).file);
      }
    }
    return files;
  }

  /**
   * Reads a doc's threads file, first re-anchoring its passage threads and saving them when the doc has changed since
   * they were last anchored
   */
  private async readCurrentDocumentFile(
    document: string
  ): Promise<{ file: DocumentThreadsFile; source: string | null }> {
    const stored = requireValid(await this.files.readDocumentFile(document));
    if (stored !== null && stored.document !== document) {
      throw new StoreError("invalid-input", `${document} has its threads stored as ${stored.document}; use that name`);
    }
    const source = await this.files.readDocumentSource(document);
    const sourceHash = source === null ? null : hashSource(source);
    if (stored === null) {
      return { file: { document, sourceHash, threads: [], version: storeFileVersion }, source };
    }
    if (stored.sourceHash === sourceHash) {
      return { file: stored, source };
    }
    const file = { ...stored, sourceHash, threads: reanchorDocumentThreads(stored.threads, source) };
    await this.files.writeDocumentFile(file);
    return { file, source };
  }

  private async replaceThreads(document: string | null, threads: Thread[]): Promise<void> {
    if (document === null) {
      const review = requireValid(await this.files.readReviewFile());
      await this.files.writeReviewFile({ ...review, threads });
      return;
    }
    const file = requireValid(await this.files.readDocumentFile(document));
    if (file === null) {
      throw new StoreError("invalid-state", `${document} has no threads file to update`);
    }
    await this.files.writeDocumentFile({ ...file, threads });
  }
}

function replaceThread(threads: readonly Thread[], id: number, replacement: Thread | null): Thread[] {
  return threads.flatMap((thread) => {
    if (thread.id !== id) {
      return [thread];
    }
    return replacement === null ? [] : [replacement];
  });
}

function requireValid<Value>(result: StoreFileResult<Value>): Value {
  if (result.kind === "invalid") {
    throw new StoreError("invalid-file", result.problem);
  }
  return result.value;
}
