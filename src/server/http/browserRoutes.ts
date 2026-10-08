import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Hono } from "hono";

import { messageRequestSchema, submitRequestSchema } from "../../shared/api/apiRequestSchemas";
import type { DocumentCount, DocumentList, DocumentSource } from "../../shared/api/apiResponseSchemas";
import { newThreadSchema } from "../../shared/review/newThreadSchema";
import type { Thread } from "../../shared/review/threadSchema";
import { hashSource } from "../store/hashSource";

import type { AppDependencies } from "./AppDependencies";
import { HttpError } from "./HttpError";
import { checkDocumentPath, readJsonBody, readThreadId } from "./requestInputs";

export function registerBrowserRoutes(app: Hono, dependencies: AppDependencies): void {
  const { events, recentDocuments, root, store, watchDocument } = dependencies;
  const threadsChanged = (): void => events.publish({ type: "threads-changed" });

  app.get("/api/documents", async (context) => {
    const { problems, threads } = await store.readThreads(null);
    const response: DocumentList = { documents: countByDocument(threads), problems, recent: recentDocuments.list() };
    return context.json(response);
  });

  app.get("/api/document", async (context) => {
    const document = context.req.query("path") ?? "";
    await checkDocumentPath(root, document, false);
    const source = await readFile(path.join(root, ...document.split("/")), "utf8");
    recentDocuments.add(document);
    watchDocument(document);
    const response: DocumentSource = { hash: hashSource(source), path: document, source };
    return context.json(response);
  });

  app.get("/api/threads", async (context) => {
    const document = context.req.query("document");
    if (document === undefined && context.req.query("all") !== "1") {
      throw new HttpError(400, "invalid-input", "Pass ?document=<path> or ?all=1");
    }
    if (document !== undefined) {
      await checkDocumentPath(root, document, true);
      watchDocument(document);
    }
    return context.json(await store.readThreads(document ?? null));
  });

  app.post("/api/threads", async (context) => {
    const newThread = await readJsonBody(context, newThreadSchema);
    if (newThread.anchor.kind !== "review") {
      await checkDocumentPath(root, newThread.anchor.document, false);
      watchDocument(newThread.anchor.document);
    }
    const thread = await store.createDraftThread(newThread);
    threadsChanged();
    return context.json({ thread }, 201);
  });

  app.put("/api/threads/:id/draft", async (context) => {
    const { body } = await readJsonBody(context, messageRequestSchema);
    const thread = await store.writeDraft(readThreadId(context), body);
    threadsChanged();
    return context.json({ thread });
  });

  app.delete("/api/threads/:id/draft", async (context) => {
    const thread = await store.deleteDraft(readThreadId(context));
    threadsChanged();
    return context.json({ thread });
  });

  app.post("/api/threads/:id/resolve", async (context) => {
    const thread = await store.resolveAsUser(readThreadId(context));
    threadsChanged();
    return context.json({ thread });
  });

  app.post("/api/submit", async (context) => {
    const { verdict } = await readJsonBody(context, submitRequestSchema);
    const result = await store.submit(verdict);
    events.publish({ type: "submitted" });
    threadsChanged();
    return context.json(result);
  });
}

function countByDocument(threads: readonly Thread[]): DocumentCount[] {
  const counts = new Map<string, { draftCount: number; openCount: number }>();
  for (const thread of threads) {
    if (thread.anchor.kind === "review") {
      continue;
    }
    const count = counts.get(thread.anchor.document) ?? { draftCount: 0, openCount: 0 };
    counts.set(thread.anchor.document, {
      draftCount: count.draftCount + (thread.draft === undefined ? 0 : 1),
      openCount: count.openCount + (thread.status === "open" ? 1 : 0),
    });
  }
  return [...counts]
    .filter(([, count]) => count.draftCount + count.openCount > 0)
    .map(([document, count]) => ({ document, ...count }))
    .sort((left, right) => left.document.localeCompare(right.document));
}
