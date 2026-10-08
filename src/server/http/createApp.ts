import { Hono } from "hono";

import type { StoreErrorReason } from "../store/StoreError";
import { StoreError } from "../store/StoreError";

import type { AppDependencies } from "./AppDependencies";
import { registerAgentRoutes } from "./agentRoutes";
import { registerBrowserRoutes } from "./browserRoutes";
import { registerEventRoutes } from "./eventRoutes";
import { registerFileRoutes } from "./fileRoutes";
import { registerHealthRoutes } from "./healthRoutes";
import { HttpError } from "./HttpError";
import { registerPollRoutes } from "./pollRoutes";
import { refuseOtherOrigins, requireAgentToken, requireBrowserOrigin, requireLocalHost } from "./securityMiddleware";
import { registerShellRoutes } from "./shellRoutes";

const statusForStoreError = {
  "invalid-file": 500,
  "invalid-input": 400,
  "invalid-state": 409,
  "missing-document": 404,
  "unknown-thread": 404,
} as const satisfies Record<StoreErrorReason, number>;

/**
 * Builds the server's HTTP app: the agent's API, the browser's API, the event stream, repo files and the app shell
 *
 * @param dependencies the store and the server's shared state
 * @returns the app, ready to be served on 127.0.0.1
 */
export function createApp(dependencies: AppDependencies): Hono {
  const { activity, logger, port, token } = dependencies;
  const app = new Hono();
  app.use("*", requireLocalHost(port));
  app.use("*", refuseOtherOrigins(port));
  app.use("*", async (_context, next) => {
    activity.touch();
    await next();
  });
  for (const agentPath of ["/api/agent/*", "/api/inbox", "/api/poll", "/api/shutdown"]) {
    app.use(agentPath, requireAgentToken(token));
  }
  for (const browserPath of ["/api/threads", "/api/threads/*", "/api/submit"]) {
    app.use(browserPath, requireBrowserOrigin(port));
  }
  app.onError((error, context) => {
    if (error instanceof HttpError) {
      return context.json({ error: { message: error.message, reason: error.reason } }, error.status);
    }
    if (error instanceof StoreError) {
      return context.json(
        { error: { message: error.message, reason: error.reason } },
        statusForStoreError[error.reason]
      );
    }
    logger.error(`${context.req.method} ${context.req.path} failed`, error);
    return context.json(
      {
        error: {
          message: "The server failed to handle the request; see .markdown-review/server.log",
          reason: "internal",
        },
      },
      500
    );
  });
  registerHealthRoutes(app, dependencies);
  registerAgentRoutes(app, dependencies);
  registerPollRoutes(app, dependencies);
  registerBrowserRoutes(app, dependencies);
  registerEventRoutes(app, dependencies);
  registerFileRoutes(app, dependencies);
  registerShellRoutes(app, dependencies);
  return app;
}
