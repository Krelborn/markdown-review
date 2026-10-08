import {
  apiErrorSchema,
  documentListSchema,
  documentSourceSchema,
  threadsSnapshotSchema,
} from "../../shared/api/apiResponseSchemas";

import type { ReviewApi } from "./ReviewApi";
import { ReviewApiError } from "./ReviewApiError";
import type { ReviewEvent } from "./reviewEventSchema";
import { reviewEventSchema } from "./reviewEventSchema";

const pushedEventTypes = ["presence", "threads-changed", "document-changed", "navigate"] as const;

/**
 * Creates the API of the server that served the page
 *
 * @returns an API whose changes are sent as JSON from the page's own origin, as the server requires
 */
export function createReviewApi(): ReviewApi {
  return {
    createThread: (newThread) => send("POST", "/api/threads", newThread),
    deleteDraft: (id) => send("DELETE", `/api/threads/${id}/draft`),
    readDocument: async (document) =>
      documentSourceSchema.parse(await receive(`/api/document?path=${encodeURIComponent(document)}`)),
    readDocuments: async () => documentListSchema.parse(await receive("/api/documents")),
    readThreads: async () => threadsSnapshotSchema.parse(await receive("/api/threads?all=1")),
    resolveThread: (id) => send("POST", `/api/threads/${id}/resolve`),
    submit: (verdict) => send("POST", "/api/submit", { verdict }),
    subscribe: subscribeToEvents,
    writeDraft: (id, body) => send("PUT", `/api/threads/${id}/draft`, { body }),
  };
}

async function receive(url: string): Promise<unknown> {
  return readBody(await fetch(url));
}

async function send(method: string, url: string, body?: unknown): Promise<void> {
  await readBody(
    await fetch(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method,
    })
  );
}

async function readBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    return body;
  }
  const refusal = apiErrorSchema.safeParse(body);
  if (!refusal.success) {
    throw new ReviewApiError(response.status, "unknown", `The review server answered ${response.status}`);
  }
  throw new ReviewApiError(response.status, refusal.data.error.reason, refusal.data.error.message);
}

function subscribeToEvents(listener: (event: ReviewEvent) => void): () => void {
  const source = new EventSource("/api/events");
  source.addEventListener("open", () => listener({ type: "connected" }));
  source.addEventListener("error", () => listener({ type: "disconnected" }));
  for (const type of pushedEventTypes) {
    source.addEventListener(type, (message) => {
      listener(reviewEventSchema.parse({ ...JSON.parse(message.data), type }));
    });
  }
  return () => source.close();
}
