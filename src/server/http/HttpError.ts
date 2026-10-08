import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * A request the server refuses, with the HTTP status and a stable `reason` the CLI and the browser can act on
 */
export class HttpError extends Error {
  public readonly reason: string;
  public readonly status: ContentfulStatusCode;

  public constructor(status: ContentfulStatusCode, reason: string, message: string) {
    super(message);
    this.name = "HttpError";
    this.reason = reason;
    this.status = status;
  }
}
