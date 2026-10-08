import type { Context, Hono } from "hono";

const contentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

const shellHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Markdown Review</title>
  </head>
  <body>
    <p>Markdown Review is running. This build has no review interface yet; the agent's commands work without it.</p>
  </body>
</html>
`;

export function registerShellRoutes(app: Hono): void {
  const serveShell = (context: Context): Response =>
    context.html(shellHtml, 200, { "Content-Security-Policy": contentSecurityPolicy });
  app.get("/", serveShell);
  app.get("/document/*", serveShell);
}
