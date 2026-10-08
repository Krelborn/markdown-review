import { afterEach, describe, expect, test, vi } from "vitest";

import { createReviewApi } from "./createReviewApi";
import { ReviewApiError } from "./ReviewApiError";
import type { ReviewEvent } from "./reviewEventSchema";

interface SentRequest {
  body: unknown;
  contentType: string | null;
  method: string;
  url: string;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createReviewApi", () => {
  test("must return the doc when the server has it", async () => {
    const sent = stubFetch(200, { hash: "a".repeat(64), path: "docs/Design Notes.md", source: "# Notes\n" });

    const document = await createReviewApi().readDocument("docs/Design Notes.md");

    expect(document.source).toBe("# Notes\n");
    expect(sent).toEqual([
      { body: undefined, contentType: null, method: "GET", url: "/api/document?path=docs%2FDesign%20Notes.md" },
    ]);
  });

  test("must send the change as JSON when the user saves a draft", async () => {
    const sent = stubFetch(200, { thread: {} });

    await createReviewApi().writeDraft(3, "Use one hour");

    expect(sent).toEqual([
      { body: '{"body":"Use one hour"}', contentType: "application/json", method: "PUT", url: "/api/threads/3/draft" },
    ]);
  });

  test("must reject with the server's reason when the server refuses a request", async () => {
    stubFetch(404, { error: { message: "docs/gone.md does not exist", reason: "missing-document" } });

    const reading = createReviewApi().readDocument("docs/gone.md");

    await expect(reading).rejects.toThrow(ReviewApiError);
    await expect(reading).rejects.toMatchObject({ reason: "missing-document", status: 404 });
  });

  test("must reject with an unknown reason when the server's refusal is not its usual error", async () => {
    stubFetch(502, "Bad Gateway");

    await expect(createReviewApi().submit("approve")).rejects.toMatchObject({
      message: "The review server answered 502",
      reason: "unknown",
    });
  });

  test("must reject a response when it does not have the documented shape", async () => {
    stubFetch(200, { threads: "none" });

    await expect(createReviewApi().readThreads()).rejects.toThrow();
  });

  test("must pass on the server's events and the connection's state when the page listens", () => {
    const source = stubEventSource();
    const received: ReviewEvent[] = [];

    createReviewApi().subscribe((event) => received.push(event));
    source.current().dispatchEvent(new Event("open"));
    source.current().dispatchEvent(new MessageEvent("presence", { data: '{"agentWaiting":true}' }));
    source.current().dispatchEvent(new MessageEvent("navigate", { data: '{"url":"http://127.0.0.1:4321/"}' }));
    source.current().dispatchEvent(new Event("error"));

    expect(received).toEqual([
      { type: "connected" },
      { agentWaiting: true, type: "presence" },
      { type: "navigate", url: "http://127.0.0.1:4321/" },
      { type: "disconnected" },
    ]);
  });

  test("must close the connection when the page stops listening", () => {
    const source = stubEventSource();
    const unsubscribe = createReviewApi().subscribe(() => {});

    unsubscribe();

    expect(source.current().closed).toBe(true);
    expect(source.current().url).toBe("/api/events");
  });
});

function stubFetch(status: number, body: unknown): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
    sent.push({
      body: init.body,
      contentType: new Headers(init.headers).get("content-type"),
      method: init.method ?? "GET",
      url,
    });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  });
  return sent;
}

function stubEventSource(): { current: () => FakeEventSource } {
  const opened: FakeEventSource[] = [];
  vi.stubGlobal(
    "EventSource",
    vi.fn(function openEventSource(url: string) {
      const source = new FakeEventSource(url);
      opened.push(source);
      return source;
    })
  );
  return {
    current: () => {
      const latest = opened.at(-1);
      if (latest === undefined) {
        throw new Error("No EventSource was opened");
      }
      return latest;
    },
  };
}

class FakeEventSource extends EventTarget {
  public closed = false;
  public readonly url: string;

  public constructor(url: string) {
    super();
    this.url = url;
  }

  public close(): void {
    this.closed = true;
  }
}
