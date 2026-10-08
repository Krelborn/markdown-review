import { timingSafeEqual } from "node:crypto";

import type { MiddlewareHandler } from "hono";

import { HttpError } from "./HttpError";

/**
 * Refuses requests whose Host header does not name this server, which blocks DNS rebinding
 *
 * @param port the port the server listens on
 */
export function requireLocalHost(port: () => number): MiddlewareHandler {
  return async (context, next) => {
    const allowedHosts = [`127.0.0.1:${port()}`, `localhost:${port()}`];
    if (!allowedHosts.includes(context.req.header("host") ?? "")) {
      throw new HttpError(403, "forbidden", "The Host header does not name this server");
    }
    await next();
  };
}

/**
 * Refuses requests a browser sends from a page on another site, so such a page can neither read the review nor connect
 * to the event stream as if it were a review tab
 *
 * @param port the port the server listens on
 */
export function refuseOtherOrigins(port: () => number): MiddlewareHandler {
  return async (context, next) => {
    const origin = context.req.header("origin");
    if (origin !== undefined && !ownOrigins(port()).includes(origin)) {
      throw new HttpError(403, "forbidden", "Requests must come from this server's own pages");
    }
    await next();
  };
}

/**
 * Lets only the CLI through: the request must carry the server's token and no Origin header, which browsers add
 *
 * @param token the secret from `server.json`
 */
export function requireAgentToken(token: string): MiddlewareHandler {
  return async (context, next) => {
    if (context.req.header("origin") !== undefined) {
      throw new HttpError(403, "forbidden", "Agent routes do not accept requests from web pages");
    }
    if (!isExpectedToken(context.req.header("authorization"), token)) {
      throw new HttpError(401, "unauthorized", "Agent routes need the token from .markdown-review/server.json");
    }
    await next();
  };
}

/**
 * Lets changes through only from this server's own pages, sent as JSON, which an HTML form on another page cannot do
 *
 * @param port the port the server listens on
 */
export function requireBrowserOrigin(port: () => number): MiddlewareHandler {
  return async (context, next) => {
    if (context.req.method === "GET" || context.req.method === "HEAD") {
      await next();
      return;
    }
    if (!ownOrigins(port()).includes(context.req.header("origin") ?? "")) {
      throw new HttpError(403, "forbidden", "Changes must come from this server's own pages");
    }
    if (!(context.req.header("content-type") ?? "").startsWith("application/json")) {
      throw new HttpError(415, "unsupported-media-type", "Changes must be sent as application/json");
    }
    await next();
  };
}

function ownOrigins(port: number): string[] {
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
}

function isExpectedToken(authorization: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(authorization ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
