import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { hashSource } from "../store/hashSource";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { cacheComment, setUpAppTest, testPlan } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("browserRoutes", () => {
  test("must return the doc's source and hash and start watching it when the browser opens a doc", async () => {
    const { browser, recentDocuments, watched } = await setUpAppTest(getDirectory());

    const response = await browser("GET", "/api/document?path=docs/plan.md");

    expect(await response.json()).toEqual({ hash: hashSource(testPlan), path: "docs/plan.md", source: testPlan });
    expect(watched).toEqual(["docs/plan.md"]);
    expect(recentDocuments.list()).toEqual(["docs/plan.md"]);
  });

  test.each([
    { condition: "the doc does not exist", document: "docs/missing.md", status: 404, reason: "missing-document" },
    { condition: "the path climbs out of the repo", document: "../secret.md", status: 400, reason: "invalid-input" },
  ])("must refuse to return a doc when $condition", async ({ document, status, reason }) => {
    const { browser } = await setUpAppTest(getDirectory());

    const response = await browser("GET", `/api/document?path=${encodeURIComponent(document)}`);

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { reason } });
  });

  test("must refuse to return a doc when a symlink in the repo leads out of it", async () => {
    const { browser, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(getDirectory(), "secret.md"), "secret\n");
    await symlink(path.join(getDirectory(), "secret.md"), path.join(root, "docs", "linked.md"));

    const response = await browser("GET", "/api/document?path=docs/linked.md");

    expect(response.status).toBe(403);
  });

  test("must create a draft and announce the change when the browser adds a comment", async () => {
    const { browser, published } = await setUpAppTest(getDirectory());

    const response = await browser("POST", "/api/threads", cacheComment);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ thread: { anchor: { startLine: 3 }, id: 1, status: "draft" } });
    expect(published).toEqual([{ type: "threads-changed" }]);
  });

  test("must open the drafts and wake waiting polls when the user submits", async () => {
    const { browser, published } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });

    const response = await browser("POST", "/api/submit", { verdict: "request-changes" });

    expect(await response.json()).toMatchObject({ review: { approved: false }, submittedThreadIds: [1, 2] });
    expect(published).toContainEqual({ type: "submitted" });
  });

  test("must replace a draft reply and then delete it when the browser edits and discards it", async () => {
    const { browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "request-changes" });

    const written = await browser("PUT", "/api/threads/1/draft", { body: "Still unclear" });
    const deleted = await browser("DELETE", "/api/threads/1/draft");

    expect(await written.json()).toMatchObject({ thread: { draft: { body: "Still unclear" } } });
    expect(await deleted.json()).not.toHaveProperty("thread.draft");
  });

  test("must report a missing thread as unknown when the browser resolves it", async () => {
    const { browser } = await setUpAppTest(getDirectory());

    const response = await browser("POST", "/api/threads/99/resolve");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { reason: "unknown-thread" } });
  });

  test("must count drafts and open threads per doc and list recent docs when the browser asks for the docs", async () => {
    const { browser, root } = await setUpAppTest(getDirectory());
    await mkdir(path.join(root, "notes"));
    await writeFile(path.join(root, "notes", "idea.md"), "Idea\n");
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "request-changes" });
    await browser("POST", "/api/threads", { anchor: { document: "docs/plan.md", kind: "document" }, body: "Doc?" });
    await browser("GET", "/api/document?path=notes/idea.md");

    const response = await browser("GET", "/api/documents");

    expect(await response.json()).toEqual({
      documents: [{ document: "docs/plan.md", draftCount: 1, openCount: 1 }],
      problems: [],
      recent: ["notes/idea.md"],
    });
  });

  test("must answer a read without an Origin header, as browsers send same-origin reads", async () => {
    const { request } = await setUpAppTest(getDirectory());

    expect((await request("GET", "/api/threads?all=1", {})).status).toBe(200);
  });

  test("must ask for a doc or all threads when the browser names neither", async () => {
    const { browser } = await setUpAppTest(getDirectory());

    expect((await browser("GET", "/api/threads")).status).toBe(400);
  });
});
