import type { Hono } from "hono";

import type { UpdateResponse } from "../../shared/api/apiResponseSchemas";
import { findAvailableUpdate } from "../update/findAvailableUpdate";
import { globalInstallCommand } from "../update/installCommands";

import type { AppDependencies } from "./AppDependencies";

export function registerUpdateRoutes(app: Hono, { installKind, updateChecker, version }: AppDependencies): void {
  app.get("/api/update", async (context) => {
    const availableVersion =
      updateChecker === null ? null : findAvailableUpdate(version, await updateChecker.distTags());
    const response: UpdateResponse = {
      availableVersion,
      command: availableVersion !== null && installKind === "global" ? globalInstallCommand : null,
    };
    return context.json(response);
  });
}
