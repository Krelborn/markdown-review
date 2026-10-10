import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Context, Hono } from "hono";

import { isRepositoryRelativePath } from "../../shared/review/isRepositoryRelativePath";
import { isFileNotFound } from "../files/isFileNotFound";
import { readTextFileOrNull } from "../files/readTextFileOrNull";

import type { AppDependencies } from "./AppDependencies";
import { HttpError } from "./HttpError";

// Only the built app's own files are served as code; a repo file with the same extension gets no runnable type
const assetContentTypes: Partial<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

const contentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

export function registerShellRoutes(app: Hono, { webDirectory }: AppDependencies): void {
  const serveShell = async (context: Context): Promise<Response> => {
    const html = await readTextFileOrNull(path.join(webDirectory, "index.html"));
    if (html === null) {
      throw new HttpError(500, "missing-web-app", "This build of markdown-review has no web app");
    }
    return context.html(html, 200, { "Content-Security-Policy": contentSecurityPolicy });
  };
  app.get("/", serveShell);
  app.get("/document/*", serveShell);

  // Plain text, because some browsers download text/markdown instead of showing it
  app.get("/licences", async (context) => {
    const licences = await readTextFileOrNull(path.join(webDirectory, "licences.md"));
    if (licences === null) {
      throw new HttpError(404, "missing-file", "This build of markdown-review has no list of third-party licences");
    }
    return context.text(licences, 200, { "X-Content-Type-Options": "nosniff" });
  });

  app.get("/assets/*", async (context) => {
    const name = context.req.path.slice("/assets/".length);
    if (!isRepositoryRelativePath(name)) {
      throw new HttpError(404, "missing-file", `${name} is not an asset`);
    }
    let contents: Buffer;
    try {
      contents = await readFile(path.join(webDirectory, "assets", ...name.split("/")));
    } catch (error) {
      if (isFileNotFound(error)) {
        throw new HttpError(404, "missing-file", `${name} is not an asset`);
      }
      throw error;
    }
    return context.body(new Uint8Array(contents), 200, {
      "Content-Type": assetContentTypes[path.extname(name)] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
    });
  });
}
