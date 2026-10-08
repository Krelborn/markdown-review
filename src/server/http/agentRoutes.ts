import type { Hono } from "hono";

import { agentOpenRequestSchema, messageRequestSchema, resolveRequestSchema } from "../../shared/api/apiRequestSchemas";
import type { AgentOpenResponse, AgentThreadResponse, ShutdownResponse } from "../../shared/api/apiResponseSchemas";
import type { Thread } from "../../shared/review/threadSchema";

import type { AppDependencies } from "./AppDependencies";
import { checkDocumentPath, readJsonBody, readThreadId } from "./requestInputs";

const shutdownDelayMilliseconds = 100;

export function registerAgentRoutes(app: Hono, dependencies: AppDependencies): void {
  const { events, port, recentDocuments, root, shutdown, store, tabs, watchDocument } = dependencies;
  const afterAgentAction = async (thread: Thread): Promise<AgentThreadResponse> => {
    events.publish({ type: "threads-changed" });
    return { inbox: await store.readInbox(null), thread };
  };

  app.post("/api/shutdown", (context) => {
    setTimeout(shutdown, shutdownDelayMilliseconds);
    const response: ShutdownResponse = { stopping: true };
    return context.json(response);
  });

  app.post("/api/agent/open", async (context) => {
    const { path } = await readJsonBody(context, agentOpenRequestSchema);
    if (path !== undefined) {
      await checkDocumentPath(root, path, false);
      recentDocuments.add(path);
      watchDocument(path);
    }
    const review = await store.requestReview();
    events.publish({ type: "threads-changed" });
    const pagePath = path === undefined ? "" : `document/${path.split("/").map(encodeURIComponent).join("/")}`;
    const url = `http://127.0.0.1:${port()}/${pagePath}`;
    const response: AgentOpenResponse = { navigated: tabs.navigateLatest(url), review, url };
    return context.json(response);
  });

  app.get("/api/inbox", async (context) => {
    const document = context.req.query("document");
    if (document !== undefined) {
      await checkDocumentPath(root, document, true);
    }
    return context.json(await store.readInbox(document ?? null));
  });

  app.post("/api/agent/threads/:id/reply", async (context) => {
    const { body } = await readJsonBody(context, messageRequestSchema);
    return context.json(await afterAgentAction(await store.replyAsAgent(readThreadId(context), body)));
  });

  app.post("/api/agent/threads/:id/resolve", async (context) => {
    const { body } = await readJsonBody(context, resolveRequestSchema);
    return context.json(await afterAgentAction(await store.resolveAsAgent(readThreadId(context), body)));
  });
}
