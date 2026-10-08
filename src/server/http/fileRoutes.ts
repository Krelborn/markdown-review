import { readFile, stat } from "node:fs/promises";

import type { Hono } from "hono";

import { resolveRepositoryPath } from "../files/resolveRepositoryPath";

import type { AppDependencies } from "./AppDependencies";
import { contentTypeFor } from "./contentTypeFor";
import { HttpError } from "./HttpError";

export function registerFileRoutes(app: Hono, { root }: AppDependencies): void {
  app.get("/files/*", async (context) => {
    const relativePath = decodeURIComponent(context.req.path.slice("/files/".length));
    const resolved = await resolveRepositoryPath(root, relativePath);
    if (resolved.kind === "invalid" || resolved.kind === "outside") {
      throw new HttpError(403, "outside-root", `${relativePath} is not a file in the repo`);
    }
    if (resolved.kind === "missing" || !(await stat(resolved.absolutePath)).isFile()) {
      throw new HttpError(404, "missing-file", `${relativePath} does not exist`);
    }
    const contents = await readFile(resolved.absolutePath);
    return context.body(new Uint8Array(contents), 200, {
      "Content-Security-Policy": "sandbox",
      "Content-Type": contentTypeFor(relativePath),
      "X-Content-Type-Options": "nosniff",
    });
  });
}
