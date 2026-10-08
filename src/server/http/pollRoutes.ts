import type { Hono } from "hono";
import { stream } from "hono/streaming";

import type { AppDependencies } from "./AppDependencies";
import { HttpError } from "./HttpError";
import { checkDocumentPath } from "./requestInputs";
import { waitForInbox } from "./waitForInbox";

const defaultTimeoutSeconds = 540;

const maximumTimeoutSeconds = 24 * 60 * 60;

export function registerPollRoutes(app: Hono, dependencies: AppDependencies): void {
  const { activity, events, logger, pollKeepAliveMilliseconds, root, store } = dependencies;

  app.get("/api/poll", async (context) => {
    const document = context.req.query("document") ?? null;
    if (document !== null) {
      await checkDocumentPath(root, document, true);
    }
    const timeoutMilliseconds = readTimeoutSeconds(context.req.query("timeout")) * 1000;
    context.header("Content-Type", "application/json");
    return stream(context, async (output) => {
      const abort = new AbortController();
      output.onAbort(() => abort.abort());
      const endPoll = activity.beginPoll();
      const keepAlive = setInterval(() => {
        output.write(" ").catch(() => abort.abort());
      }, pollKeepAliveMilliseconds);
      try {
        const result = await waitForInbox({ document, events, signal: abort.signal, store, timeoutMilliseconds });
        if (!abort.signal.aborted) {
          await output.write(JSON.stringify(result));
        }
      } catch (error) {
        logger.error("A poll failed", error);
        await output.write(
          JSON.stringify({ error: { message: "The poll failed; see .markdown-review/server.log", reason: "internal" } })
        );
      } finally {
        clearInterval(keepAlive);
        endPoll();
      }
    });
  });
}

function readTimeoutSeconds(value: string | undefined): number {
  if (value === undefined) {
    return defaultTimeoutSeconds;
  }
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > maximumTimeoutSeconds) {
    throw new HttpError(
      400,
      "invalid-input",
      `The timeout must be a whole number of seconds up to ${maximumTimeoutSeconds}`
    );
  }
  return seconds;
}
