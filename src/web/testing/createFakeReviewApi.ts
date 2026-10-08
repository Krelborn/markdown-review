import type { Mock } from "vitest";
import { vi } from "vitest";

import type { DocumentCount, ThreadsSnapshot } from "../../shared/api/apiResponseSchemas";
import { createDocumentText } from "../../shared/markdown/createDocumentText";
import { linesForRange } from "../../shared/markdown/linesForRange";
import type { Anchor } from "../../shared/review/anchorSchema";
import type { NewThread } from "../../shared/review/newThreadSchema";
import type { Thread } from "../../shared/review/threadSchema";
import type { ReviewApi } from "../api/ReviewApi";
import { ReviewApiError } from "../api/ReviewApiError";
import type { ReviewEvent } from "../api/reviewEventSchema";

const testDocument = "# Plan\n\nWe cache results for **24h** today.\n\nRetries happen three times.\n";

export interface FakeReviewApiOptions {
  documents?: Record<string, string>;
  recent?: string[];
  threads?: Thread[];
}

export interface FakeReviewApi {
  /**
   * The API to give the code under test; every method is a spy over an in-memory server
   */
  api: { [Method in keyof ReviewApi]: Mock<ReviewApi[Method]> };

  /**
   * Sends an event to every listener, as the server's event stream does
   */
  emit(event: ReviewEvent): void;

  /**
   * What the in-memory server holds; a test may change it before it emits `threads-changed`
   */
  snapshot: ThreadsSnapshot;
}

/**
 * Creates a review API over an in-memory server holding `docs/plan.md`, which keeps threads the way the real server
 * does and announces every change to its listeners
 */
export function createFakeReviewApi({
  documents = { "docs/plan.md": testDocument },
  recent = [],
  threads = [],
}: FakeReviewApiOptions = {}): FakeReviewApi {
  const snapshot: ThreadsSnapshot = {
    problems: [],
    review: { approved: false, approvedAt: null, requestedAt: "2026-10-08T09:00:00.000Z" },
    threads: structuredClone(threads),
  };
  const listeners = new Set<(event: ReviewEvent) => void>();
  const emit = (event: ReviewEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };
  const change = (id: number, update: (thread: Thread, at: string) => Thread | null): Promise<void> => {
    const thread = snapshot.threads.find((candidate) => candidate.id === id);
    if (thread === undefined) {
      return Promise.reject(new ReviewApiError(404, "unknown-thread", `No thread #${id}`));
    }
    const updated = update(thread, new Date().toISOString());
    snapshot.threads = snapshot.threads.flatMap((candidate) => {
      if (candidate.id !== id) {
        return [candidate];
      }
      return updated === null ? [] : [updated];
    });
    emit({ type: "threads-changed" });
    return Promise.resolve();
  };
  const api: ReviewApi = {
    createThread: ({ anchor, body }) => {
      const at = new Date().toISOString();
      const id = Math.max(0, ...snapshot.threads.map((thread) => thread.id)) + 1;
      const threadAnchor = toThreadAnchor(anchor, documents);
      snapshot.threads.push({
        anchor: threadAnchor,
        createdAt: at,
        draft: { at, body },
        id,
        messages: [],
        status: "draft",
        updatedAt: at,
      });
      emit({ type: "threads-changed" });
      return Promise.resolve();
    },
    deleteDraft: (id) => change(id, ({ draft: _draft, ...thread }) => (thread.status === "draft" ? null : thread)),
    readDocument: (document) => {
      const source = documents[document];
      return source === undefined
        ? Promise.reject(new ReviewApiError(404, "missing-document", `${document} does not exist`))
        : Promise.resolve({ hash: `hash of ${document}`, path: document, source });
    },
    readDocuments: () => Promise.resolve({ documents: countByDocument(snapshot.threads), problems: [], recent }),
    readThreads: () => Promise.resolve(structuredClone(snapshot)),
    resolveThread: (id) => change(id, (thread, at) => ({ ...thread, status: "resolved", updatedAt: at })),
    submit: (verdict) => {
      const at = new Date().toISOString();
      snapshot.threads = snapshot.threads.map(({ draft, ...thread }) =>
        draft === undefined
          ? { ...thread }
          : {
              ...thread,
              messages: [...thread.messages, { at, author: "user", body: draft.body }],
              status: "open",
              updatedAt: at,
            }
      );
      snapshot.review = {
        ...snapshot.review,
        approved: verdict === "approve",
        approvedAt: verdict === "approve" ? at : null,
      };
      emit({ type: "threads-changed" });
      return Promise.resolve();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    writeDraft: (id, body) => change(id, (thread, at) => ({ ...thread, draft: { at, body }, updatedAt: at })),
  };
  return {
    api: {
      createThread: vi.fn(api.createThread),
      deleteDraft: vi.fn(api.deleteDraft),
      readDocument: vi.fn(api.readDocument),
      readDocuments: vi.fn(api.readDocuments),
      readThreads: vi.fn(api.readThreads),
      resolveThread: vi.fn(api.resolveThread),
      submit: vi.fn(api.submit),
      subscribe: vi.fn(api.subscribe),
      writeDraft: vi.fn(api.writeDraft),
    },
    emit,
    snapshot,
  };
}

function toThreadAnchor(anchor: NewThread["anchor"], documents: Record<string, string>): Anchor {
  if (anchor.kind !== "passage") {
    return anchor;
  }
  const documentText = createDocumentText(documents[anchor.document] ?? "");
  const lines = linesForRange(documentText, anchor.startOffset, anchor.endOffset);
  return { ...anchor, ...lines, anchoredText: anchor.quote, outdated: false };
}

function countByDocument(threads: readonly Thread[]): DocumentCount[] {
  const counts = new Map<string, DocumentCount>();
  for (const thread of threads) {
    if (thread.anchor.kind !== "review") {
      const count = counts.get(thread.anchor.document) ?? {
        document: thread.anchor.document,
        draftCount: 0,
        openCount: 0,
      };
      counts.set(thread.anchor.document, {
        ...count,
        draftCount: count.draftCount + (thread.draft === undefined ? 0 : 1),
        openCount: count.openCount + (thread.status === "open" ? 1 : 0),
      });
    }
  }
  return [...counts.values()];
}
