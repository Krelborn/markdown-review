import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { AppDependencies } from "./AppDependencies";

export function registerEventRoutes(app: Hono, { activity, events, logger, tabs }: AppDependencies): void {
  app.get("/api/events", (context) =>
    streamSSE(context, async (output) => {
      let writes = Promise.resolve();
      const send = (event: string, data: unknown): void => {
        writes = writes
          .then(() => output.writeSSE({ data: JSON.stringify(data), event }))
          .catch((error: unknown) => logger.warn("Could not write to a browser's event stream", error));
      };
      const endBrowser = activity.beginBrowser();
      const unsubscribe = events.subscribe((event) => {
        if (event.type !== "submitted") {
          const { type, ...data } = event;
          send(type, data);
        }
      });
      const disconnect = tabs.connect({ navigate: (url) => send("navigate", { url }) });
      send("presence", { agentWaiting: activity.agentWaiting });
      await new Promise<void>((resolve) => output.onAbort(resolve));
      unsubscribe();
      disconnect();
      endBrowser();
    })
  );
}
