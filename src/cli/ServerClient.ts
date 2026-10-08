import type { ZodType } from "zod";

import type {
  AgentOpenResponse,
  AgentThreadResponse,
  Health,
  PollResponse,
  ThreadsSnapshot,
} from "../shared/api/apiResponseSchemas";
import {
  agentOpenResponseSchema,
  agentThreadResponseSchema,
  apiErrorSchema,
  healthSchema,
  pollResponseSchema,
  shutdownResponseSchema,
  threadsSnapshotSchema,
} from "../shared/api/apiResponseSchemas";

import { ServerRequestError } from "./ServerRequestError";

const healthTimeoutMilliseconds = 1000;

/**
 * Talks to one root's review server on behalf of the agent
 */
export class ServerClient {
  public readonly port: number;
  private readonly token: string;

  public constructor(port: number, token: string) {
    this.port = port;
    this.token = token;
  }

  /**
   * @throws when nothing answers on the port within a second
   */
  public health(): Promise<Health> {
    return this.request("GET", "/api/health", healthSchema, { signal: AbortSignal.timeout(healthTimeoutMilliseconds) });
  }

  public open(document: string | null): Promise<AgentOpenResponse> {
    return this.request("POST", "/api/agent/open", agentOpenResponseSchema, {
      body: document === null ? {} : { path: document },
    });
  }

  public inbox(document: string | null): Promise<ThreadsSnapshot> {
    return this.request("GET", `/api/inbox${documentQuery(document)}`, threadsSnapshotSchema);
  }

  /**
   * Waits for the review to be approved, a thread to need the agent, or the timeout
   */
  public poll(document: string | null, timeoutSeconds: number, signal: AbortSignal): Promise<PollResponse> {
    const query = new URLSearchParams({ timeout: String(timeoutSeconds) });
    if (document !== null) {
      query.set("document", document);
    }
    return this.request("GET", `/api/poll?${query}`, pollResponseSchema, { signal });
  }

  public reply(id: number, body: string): Promise<AgentThreadResponse> {
    return this.request("POST", `/api/agent/threads/${id}/reply`, agentThreadResponseSchema, { body: { body } });
  }

  public resolve(id: number, body: string | null): Promise<AgentThreadResponse> {
    return this.request("POST", `/api/agent/threads/${id}/resolve`, agentThreadResponseSchema, { body: { body } });
  }

  public async shutdown(): Promise<void> {
    await this.request("POST", "/api/shutdown", shutdownResponseSchema);
  }

  private async request<Value>(
    method: string,
    path: string,
    schema: ZodType<Value>,
    { body, signal }: { body?: unknown; signal?: AbortSignal } = {}
  ): Promise<Value> {
    const response = await fetch(`http://127.0.0.1:${this.port}${path}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      method,
      signal,
    });
    const text = await response.text();
    const value = parseJson(text);
    const refusal = apiErrorSchema.safeParse(value);
    if (!response.ok || refusal.success) {
      const { message, reason } = refusal.data?.error ?? { message: text, reason: "unknown" };
      throw new ServerRequestError(response.status, reason, message);
    }
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new ServerRequestError(response.status, "unreadable-response", `${method} ${path} answered with ${text}`);
    }
    return result.data;
  }
}

function documentQuery(document: string | null): string {
  return document === null ? "" : `?${new URLSearchParams({ document })}`;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
