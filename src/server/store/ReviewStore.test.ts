import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createDocumentText } from "../../shared/markdown/createDocumentText";
import type { NewThread } from "../../shared/review/newThreadSchema";
import { buildThread } from "../../shared/review/testing/reviewBuilders";
import { createMemoryLogger } from "../logging/testing/createMemoryLogger";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { hashSource } from "./hashSource";
import { ReviewStore } from "./ReviewStore";
import { StoreError } from "./StoreError";

const getDirectory = setUpTemporaryDirectory();

const plan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

afterEach(() => {
  vi.useRealTimers();
});

describe("ReviewStore", () => {
  test("must anchor a passage comment at the selected lines when the browser rendered the current doc", async () => {
    const { store } = await setUpLoadedTest();

    const thread = await store.createDraftThread(commentOn(plan, "cache results for 24h"));

    expect(thread.anchor).toMatchObject({ endLine: 3, kind: "passage", outdated: false, startLine: 3 });
  });

  test("must give each new thread the next ID when comments are added to the review and to docs", async () => {
    const { store } = await setUpLoadedTest();

    const first = await store.createDraftThread({ anchor: { kind: "review" }, body: "Overall?" });
    const second = await store.createDraftThread(commentOn(plan, "three times"));

    expect([first.id, second.id]).toEqual([1, 2]);
  });

  test("must give distinct IDs when two comments are created at the same time", async () => {
    const { store } = await setUpLoadedTest();

    const threads = await Promise.all([
      store.createDraftThread({ anchor: { kind: "review" }, body: "One" }),
      store.createDraftThread({ anchor: { document: "docs/plan.md", kind: "document" }, body: "Two" }),
    ]);

    expect(threads.map((thread) => thread.id).sort()).toEqual([1, 2]);
  });

  test("must keep a draft out of the agent's inbox until the user submits it", async () => {
    const { store } = await setUpLoadedTest();
    await store.createDraftThread(commentOn(plan, "cache results for 24h"));

    const beforeSubmit = await store.readInbox(null);
    await store.submit("request-changes");
    const afterSubmit = await store.readInbox(null);

    expect(beforeSubmit.threads).toEqual([]);
    expect(afterSubmit.threads.map((thread) => thread.id)).toEqual([1]);
  });

  test("must hand the user's reply to the agent when it was drafted before an agent reply and submitted after it", async () => {
    const { advanceClock, store } = await setUpLoadedTest();
    await store.createDraftThread({ anchor: { kind: "review" }, body: "Why 24h?" });
    await store.submit("request-changes");
    await store.writeDraft(1, "Upstream changes hourly");
    advanceClock();
    await store.replyAsAgent(1, "Which upstream?");
    advanceClock();

    await store.submit("request-changes");

    const inbox = await store.readInbox(null);
    expect(inbox.threads[0]?.messages.map(({ author }) => author)).toEqual(["user", "agent", "user"]);
  });

  test("must hide a draft thread from the agent when the agent replies to it", async () => {
    const { store } = await setUpLoadedTest();
    await store.createDraftThread({ anchor: { kind: "review" }, body: "Why?" });

    await expect(store.replyAsAgent(1, "Because")).rejects.toMatchObject({ reason: "unknown-thread" });
  });

  test("must resolve the thread when the agent resolves one it has already replied to", async () => {
    const { store } = await setUpLoadedTest();
    await store.createDraftThread({ anchor: { kind: "review" }, body: "Why?" });
    await store.submit("request-changes");
    await store.replyAsAgent(1, "Because");

    const thread = await store.resolveAsAgent(1, null);

    expect(thread.status).toBe("resolved");
  });

  test("must reopen a thread the user resolved when the user then submits a reply to it", async () => {
    const { store } = await setUpLoadedTest();
    await store.createDraftThread({ anchor: { kind: "review" }, body: "Why?" });
    await store.submit("request-changes");
    await store.resolveAsUser(1);
    await store.writeDraft(1, "Actually, one more thing");

    await store.submit("request-changes");

    expect((await store.readInbox(null)).threads.map((thread) => thread.status)).toEqual(["open"]);
  });

  test("must delete a draft thread when the user deletes its draft", async () => {
    const { store } = await setUpLoadedTest();
    await store.createDraftThread({ anchor: { kind: "review" }, body: "Why?" });

    await store.deleteDraft(1);

    expect((await store.readThreads(null)).threads).toEqual([]);
  });

  test("must end the round when the user approves with no drafts, until the agent opens the review again", async () => {
    const { advanceClock, store } = await setUpLoadedTest();
    await store.requestReview();
    advanceClock();

    const approved = await store.submit("approve");
    advanceClock();
    const nextRound = await store.requestReview();

    expect(approved.review.approved).toBe(true);
    expect(nextRound.approved).toBe(false);
  });

  test("must refuse when the user requests changes with no drafts", async () => {
    const { store } = await setUpLoadedTest();

    await expect(store.submit("request-changes")).rejects.toMatchObject({ reason: "invalid-state" });
  });

  test("must refuse a comment when its doc does not exist", async () => {
    const { store } = await setUpLoadedTest();

    const comment = store.createDraftThread({ anchor: { document: "docs/missing.md", kind: "document" }, body: "?" });

    await expect(comment).rejects.toMatchObject({ reason: "missing-document" });
  });

  test("must report the moved lines and save the new hash when the doc was edited while nothing was reading it", async () => {
    const { readStoredDocumentFile, store, writeDocument } = await setUpLoadedTest();
    await store.createDraftThread(commentOn(plan, "three times"));
    await store.submit("request-changes");
    const edited = `# Plan\n\nIntro.\n\n${plan.slice("# Plan\n\n".length)}`;
    await writeDocument("docs/plan.md", edited);

    const inbox = await store.readInbox(null);

    expect(inbox.threads[0]?.anchor).toMatchObject({ endLine: 7, startLine: 7 });
    expect((await readStoredDocumentFile()).sourceHash).toBe(hashSource(edited));
  });

  test("must mark passage threads outdated when the doc is deleted and restore them when it returns", async () => {
    const { root, store, writeDocument } = await setUpLoadedTest();
    await store.createDraftThread(commentOn(plan, "three times"));
    await rm(path.join(root, "docs", "plan.md"));

    const whileMissing = await store.readThreads("docs/plan.md");
    await writeDocument("docs/plan.md", plan);
    const afterReturn = await store.readThreads("docs/plan.md");

    expect(whileMissing.threads[0]?.anchor).toMatchObject({ outdated: true });
    expect(afterReturn.threads[0]?.anchor).toMatchObject({ outdated: false });
  });

  test("must report an invalid threads file without overwriting it and still return the other threads", async () => {
    const { root, store, writeDocument } = await setUpLoadedTest();
    await store.createDraftThread({ anchor: { kind: "review" }, body: "Overall?" });
    await writeDocument("docs/other.md", "# Other\n");
    const invalidPath = path.join(root, ".markdown-review", "documents", "docs", "other.md.json");
    await mkdir(path.dirname(invalidPath), { recursive: true });
    await writeFile(invalidPath, "{ broken");

    const snapshot = await store.readThreads(null);
    const comment = store.createDraftThread({ anchor: { document: "docs/other.md", kind: "document" }, body: "?" });

    expect(snapshot.threads.map((thread) => thread.id)).toEqual([1]);
    expect(snapshot.problems).toEqual([expect.stringContaining(`${invalidPath} is not valid JSON`)]);
    await expect(comment).rejects.toBeInstanceOf(StoreError);
    expect(await readFile(invalidPath, "utf8")).toBe("{ broken");
  });

  test("must renumber the later of two threads that share an ID and log it when the store is initialized", async () => {
    const { entries, root, store } = setUpTest();
    const shared = buildThread({ createdAt: "2026-10-08T08:00:00.000Z", id: 1 });
    const merged = buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, id: 1 });
    await writeJson(path.join(root, ".markdown-review", "review.json"), {
      approvedAt: null,
      requestedAt: null,
      threads: [shared],
      version: 1,
    });
    await writeJson(path.join(root, ".markdown-review", "documents", "docs", "plan.md.json"), {
      document: "docs/plan.md",
      sourceHash: null,
      threads: [merged],
      version: 1,
    });

    await store.initialize();

    const snapshot = await store.readThreads(null);
    expect(snapshot.threads.map((thread) => thread.id)).toEqual([1, 2]);
    expect(entries).toEqual([
      { level: "info", message: "Thread #1 in docs/plan.md was renumbered to #2 because its ID was taken" },
    ]);
  });
});

function setUpTest() {
  vi.useFakeTimers({ toFake: ["Date"] });
  let now = Date.parse("2026-10-08T09:00:00.000Z");
  vi.setSystemTime(now);
  const root = getDirectory();
  const { entries, logger } = createMemoryLogger();
  const advanceClock = (): void => {
    now += 60_000;
    vi.setSystemTime(now);
  };
  const writeDocument = async (document: string, source: string): Promise<void> => {
    const filePath = path.join(root, ...document.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, source);
  };
  const readStoredDocumentFile = async (): Promise<{ sourceHash: string | null }> =>
    JSON.parse(await readFile(path.join(root, ".markdown-review", "documents", "docs", "plan.md.json"), "utf8"));
  const store = new ReviewStore(root, logger);
  return { advanceClock, entries, readStoredDocumentFile, root, store, writeDocument };
}

async function setUpLoadedTest() {
  const setUp = setUpTest();
  await setUp.store.initialize();
  await setUp.writeDocument("docs/plan.md", plan);
  return setUp;
}

/**
 * Builds the comment the browser sends when the user selects the first occurrence of `quote` in `source`
 */
function commentOn(source: string, quote: string): NewThread {
  const { text } = createDocumentText(source);
  const startOffset = text.indexOf(quote);
  const endOffset = startOffset + quote.length;
  return {
    anchor: {
      document: "docs/plan.md",
      endOffset,
      kind: "passage",
      prefix: text.slice(Math.max(0, startOffset - 32), startOffset),
      quote,
      startOffset,
      suffix: text.slice(endOffset, endOffset + 32),
    },
    body: "Why?",
    renderedHash: hashSource(source),
  };
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(value));
}
