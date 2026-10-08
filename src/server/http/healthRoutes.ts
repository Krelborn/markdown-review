import type { Hono } from "hono";

import type { Health } from "../../shared/api/apiResponseSchemas";
import { protocolVersion } from "../../shared/api/protocolVersion";

import type { AppDependencies } from "./AppDependencies";

export function registerHealthRoutes(app: Hono, { root, version }: AppDependencies): void {
  app.get("/api/health", (context) => {
    const health: Health = { name: "markdown-review", pid: process.pid, protocol: protocolVersion, root, version };
    return context.json(health);
  });
}
