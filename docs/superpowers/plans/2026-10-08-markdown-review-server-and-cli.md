# Markdown Review Server and CLI Implementation Plan (plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the per-repo review server and the agent's `markdown-review` CLI, so an agent can open a review, wait for comments, and reply to and resolve them, with the browser API the web app (plan 3) will use already in place and tested.

**Architecture:** `src/server/http/` is a Hono app built by `createApp` from injected dependencies (the plan 1 `ReviewStore`, an event bus, the connected tabs and an activity monitor), so every route is tested in-process with `app.request`. `src/server/runtime/runServer` serves that app on 127.0.0.1, records itself in a private `server.json`, watches docs, and stops when idle. `src/cli/` is the agent's CLI: it finds the repo root, connects to the root's server or starts one detached under a lock (as `markdown-review serve --root <root>`), and prints compact text ending in `next_step`. Vite builds the CLI and server into one `dist/cli.js`, which the integration tests run as real processes.

**Tech Stack:** TypeScript 7, Hono 4 and `@hono/node-server` 2, chokidar 5, `open` 11, zod 4, Node's `node:util` `parseArgs`, Vite 8 (SSR build), Vitest 5, oxlint, oxfmt, fallow.

**Spec:** `docs/superpowers/specs/2026-10-08-markdown-review-design.md`. This plan implements the `server`, `watcher`, `events` and `cli` units of section 5 with root and server discovery, section 8 (except `install-skill` and `SKILL.md`, which are plan 3), section 9 (the app shell is a placeholder until plan 3), sections 12 and 13, the integration and CLI-formatting tests of section 14, and the build and `bin` entry of section 15. It builds on the plan 1 code on `main`, chiefly `ReviewStore`.

## Global Constraints

- Everything in plan 1's Global Constraints still holds: macOS and Linux; Node `^22.22.2 || ^24.15.0 || >=26.0.0`; pnpm 10.18.3; `pnpm add` with no hand-written version, then `pnpm format`; oxlint and oxfmt, no ESLint; TypeScript strict with `noUncheckedIndexedAccess`; the `coding-standards` plugin's standards are authoritative over this plan's code.
- Full words in identifiers, as in pull-request-assistant: durations end in `Milliseconds` (never `Ms`), and the CLI's I/O type is `CliTerminal`, not `CliIo`. Names that mirror an external API keep that API's spelling (`parseArgs`'s `args`, `spawn`'s `cwd`, `env`, `stdout`, `stderr`).
- Type imports come before value imports from the same module.
- The server listens on `127.0.0.1` only. It tries `preferredPort(root)` (49152-65535) first, then an OS-assigned port.
- `.markdown-review/server.json` is `{ pid, port, protocol, root, startedAt, token, version }`, written atomically with file mode 0600. `server.lock` holds the starting CLI's pid. `server.log` receives the detached server's output.
- `protocolVersion` is 1. Bump it for any change to the HTTP API or store format that an older CLI or server could not handle.
- Security (spec section 13): every request's `Host` must be `127.0.0.1:<port>` or `localhost:<port>`. Agent routes (`/api/agent/*`, `/api/inbox`, `/api/poll`, `/api/shutdown`) need `Authorization: Bearer <token>` and refuse any `Origin` header. Browser mutations need `Origin` equal to the server's origin and `Content-Type: application/json`. `/files/*` resolves real paths inside the root and sends `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`.
- `poll` defaults to `--timeout 540`. A waiting poll writes a space every 15 seconds. The server stops after 30 minutes with no connected tab, no waiting poll and no request.
- Every CLI command, including errors, ends with a `next_step` line. Exit codes: 0 success, 1 failure, 2 usage error, 130 and 143 for an interrupted poll.
- `MARKDOWN_REVIEW_NO_BROWSER=1` stops `open` from launching a browser; the tests set it.
- Every commit passes the pre-commit hook, including `fallow audit`. An export, class member or file that nothing in the same commit uses (code or tests) blocks the commit, so each task only adds what its own code or tests use.
- Vitest's `node` project reports a missing module as `Cannot find module './x'`. That message is the expected failure wherever a step's test imports a module the task has not written yet.

## Review Focus

These inputs are implied by the spec but easy to miss. Each has a test in the task that owns the code.

1. **The server stops while the agent's poll is waiting**, for example because another CLI ran `stop` or replaced an older server. The agent should be told to run `poll` again, not shown a bare `terminated`. Pinned by "must tell the agent to poll again when the server stops while the poll waits" in `runCli.test.ts` (Task 11).
2. **The agent's shell kills `poll` mid-wait.** The browser's "Agent waiting" status must clear rather than stay on forever. Pinned by "must stop counting the agent as waiting when its poll disconnects" in `pollRoutes.test.ts` (Task 6).
3. **Two agents poll the same repo.** The spec says polling never consumes threads, so a submit must reach both. Pinned by "must hand the threads to every waiting poll when two agents poll at once" (Task 6).
4. **Doc and file names with spaces or non-ASCII characters.** The URL `open` prints must be encoded, and `/files/*` must decode it. Pinned by "must encode the doc's path in the URL when its name has spaces and non-ASCII characters" (Task 6) and "must find the file when its name has spaces and the link encodes them" (Task 4).
5. **Two CLI commands race to start the server**, as when an agent starts a background `poll` and runs `inbox`. Exactly one server must start. Pinned by "must run one task at a time and remove the lock afterwards when two commands start together" in `withStartLock.test.ts` (Task 10) and "must start exactly one server when several commands run at once" (Task 12).

## Notes for the implementer

- Every file in this plan was written and run in a scratch clone of the repository on 2026-10-08, then replayed task by task from `main`, with each task committed through the real pre-commit hook. At every commit, `pnpm verify` and the fallow gate passed; the suite grows from plan 1's 215 tests to 356. Still run each failing test before its implementation exists and check it fails for the stated reason.
- Work on a branch (for example `server-and-cli`), not on `main`.
- Several files change across tasks: `createApp.ts` (Tasks 4 to 7), `testing/setUpAppTest.ts` (Tasks 4 and 5), `storePaths.ts` (Tasks 8 and 10), `nextSteps.ts` (Tasks 9 and 11) and `tsconfig.server.json` (Tasks 8 and 12). Each task gives the whole file as it should be after that task.
- Decisions this plan makes where the spec is silent or loose. They are recorded so a reviewer can weigh them:
  - **Idle timer:** any request also restarts the 30-minute countdown, so an agent that only uses `inbox` and `resolve` is not cut off mid-session.
  - **Browser mutations** also need `Content-Type: application/json`, which an HTML form cannot send (this was flagged in plan 1's final review).
  - **`serve`:** the CLI starts the server as `markdown-review serve --root <root>`, an internal command not listed in `--help`.
  - **Responses:** `GET /api/threads` and the inbox also return `approved` and `problems`. Agent reply and resolve return `{ thread, inbox }`, so the CLI can say what is left without a second request. `GET /api/documents` returns `{ documents: [{ document, draftCount, openCount }], problems, recent }`.
  - **Where security checks are tested:** the host, origin and token checks run in-process against the same app object; the integration tests cover the real processes and the CLI.
  - **App shell:** `GET /` and `GET /document/*` serve a placeholder page with the spec's Content Security Policy until plan 3 builds the web app.
- Plan 3 hand-offs this plan prepares:
  - `GET /api/events` sends `presence` first, then `threads-changed`, `document-changed` and `navigate`.
  - `GET /api/document` starts watching the doc.
  - The browser must send `Origin` and `Content-Type: application/json` on every change.

## File Structure

```
src/shared/api/
  protocolVersion.ts                 HTTP API and store format version
  apiRequestSchemas.ts               request bodies the server validates (open, reply, resolve, submit)
  apiResponseSchemas.ts              responses the CLI and the browser validate
src/server/events/
  ServerEvents.ts                    in-process event bus (submitted, threads-changed, document-changed, presence)
  BrowserTabs.ts                     connected tabs, for "show this doc in the latest tab"
src/server/files/resolveRepositoryPath.ts   real-path confinement to the repo
src/server/http/
  createApp.ts                       builds the Hono app: middleware, error mapping, route registration
  AppDependencies.ts, HttpError.ts   app inputs; refusals with a status and reason
  securityMiddleware.ts              Host, agent token and browser Origin checks
  requestInputs.ts                   body, thread ID and doc path checks
  healthRoutes.ts, agentRoutes.ts, pollRoutes.ts, waitForInbox.ts
  browserRoutes.ts, eventRoutes.ts, fileRoutes.ts, contentTypeFor.ts, shellRoutes.ts
  RecentDocuments.ts                 docs recently opened or shown
  testing/setUpAppTest.ts, testing/readServerSentEvents.ts
src/server/runtime/
  runServer.ts                       serves the app, writes server.json, watches docs, stops when idle
  ActivityMonitor.ts, DocumentWatcher.ts, preferredPort.ts
  serverFileSchema.ts, packageVersion.ts, createConsoleLogger.ts
src/cli/
  main.ts                            the bin entry
  runCli.ts, helpText.ts             dispatch, usage, error reporting
  commands/                          open, inbox, poll, reply and resolve, stop, serve
  connectToServer.ts, findServer.ts, withStartLock.ts, ServerClient.ts
  formatInbox.ts, formatAgentAction.ts, formatIdList.ts, nextSteps.ts
  findRoot.ts, toRepositoryPath.ts, readDocumentOption.ts, readMessageBody.ts, readThreadIdArgument.ts
  CliTerminal.ts, CliContext.ts, CliError.ts, ServerRequestError.ts, createProcessTerminal.ts
src/integration/                     the built CLI driven as real processes against temp git repos
vite.config.mts                      builds dist/cli.js
```

---

### Task 1: Shared API schemas

**Files:**
- Create: `src/shared/api/apiRequestSchemas.ts`, `src/shared/api/apiResponseSchemas.ts`
- Modify: `src/server/store/ReviewStore.ts` (the `Verdict` and `ThreadsSnapshot` types move to the shared schemas)
- Test: `src/shared/api/apiRequestSchemas.test.ts`, `src/shared/api/apiResponseSchemas.test.ts`

**Interfaces:**
- Consumes: `documentPathSchema` (plan 1, `anchorSchema.ts`), `messageBodySchema` and `threadSchema` (plan 1, `threadSchema.ts`), `ReviewState` (plan 1), `buildThread` and `testTime` (plan 1 test builders).
- Produces:
  - `agentOpenRequestSchema` (`{ path?: string }`), `messageRequestSchema` (`{ body }`), `resolveRequestSchema` (`{ body: string | null }`), `submitRequestSchema` (`{ verdict }`), `type Verdict = "request-changes" | "approve"`.
  - `healthSchema`/`Health` (`{ name: "markdown-review", pid, protocol, root, version }`), `threadsSnapshotSchema`/`ThreadsSnapshot` (`{ problems: string[]; review: ReviewState; threads: Thread[] }`), `pollResponseSchema`/`PollResponse` (snapshot plus `timedOut`), `agentOpenResponseSchema`/`AgentOpenResponse` (`{ navigated, review, url }`), `agentThreadResponseSchema`/`AgentThreadResponse` (`{ inbox, thread }`), `shutdownResponseSchema`/`ShutdownResponse` (`{ stopping: true }`), `apiErrorSchema` (`{ error: { message, reason } }`).
  - `ReviewStore` keeps its methods; `readThreads` and `readInbox` now return the shared `ThreadsSnapshot`, and `submit` takes the shared `Verdict`.

- [ ] **Step 1: Create the branch**

```bash
git switch -c server-and-cli
```

- [ ] **Step 2: Write the failing tests**

`src/shared/api/apiRequestSchemas.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import type { Verdict } from "./apiRequestSchemas";
import {
  agentOpenRequestSchema,
  messageRequestSchema,
  resolveRequestSchema,
  submitRequestSchema,
} from "./apiRequestSchemas";

describe("apiRequestSchemas", () => {
  test("must accept an open request when it names a repo-relative doc or no doc", () => {
    expect(agentOpenRequestSchema.safeParse({ path: "docs/plan.md" }).success).toBe(true);
    expect(agentOpenRequestSchema.safeParse({}).success).toBe(true);
  });

  test("must refuse an open request when its path leaves the repo", () => {
    expect(agentOpenRequestSchema.safeParse({ path: "../secret.md" }).success).toBe(false);
  });

  test("must refuse a reply or draft when its body is blank", () => {
    expect(messageRequestSchema.safeParse({ body: "  " }).success).toBe(false);
  });

  test("must accept a resolve request when it has no message", () => {
    expect(resolveRequestSchema.safeParse({ body: null }).success).toBe(true);
  });

  test.each<{ verdict: Verdict }>([{ verdict: "approve" }, { verdict: "request-changes" }])(
    "must accept a submit when the verdict is $verdict",
    ({ verdict }) => {
      expect(submitRequestSchema.safeParse({ verdict }).success).toBe(true);
    }
  );
});
````

`src/shared/api/apiResponseSchemas.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { buildThread, testTime } from "../review/testing/reviewBuilders";

import type {
  AgentOpenResponse,
  AgentThreadResponse,
  Health,
  PollResponse,
  ShutdownResponse,
  ThreadsSnapshot,
} from "./apiResponseSchemas";
import {
  agentOpenResponseSchema,
  agentThreadResponseSchema,
  apiErrorSchema,
  healthSchema,
  pollResponseSchema,
  shutdownResponseSchema,
  threadsSnapshotSchema,
} from "./apiResponseSchemas";

const review = { approved: false, approvedAt: null, requestedAt: testTime };

const inbox: ThreadsSnapshot = { problems: [], review, threads: [buildThread()] };

describe("apiResponseSchemas", () => {
  test("must accept each response the server sends when it has the documented shape", () => {
    const health: Health = { name: "markdown-review", pid: 42, protocol: 1, root: "/repo", version: "0.1.0" };
    const poll: PollResponse = { ...inbox, timedOut: false };
    const opened: AgentOpenResponse = { navigated: false, review, url: "http://127.0.0.1:50000/" };
    const acted: AgentThreadResponse = { inbox, thread: buildThread() };
    const stopping: ShutdownResponse = { stopping: true };

    expect(healthSchema.parse(health)).toEqual(health);
    expect(threadsSnapshotSchema.parse(inbox)).toEqual(inbox);
    expect(pollResponseSchema.parse(poll)).toEqual(poll);
    expect(agentOpenResponseSchema.parse(opened)).toEqual(opened);
    expect(agentThreadResponseSchema.parse(acted)).toEqual(acted);
    expect(shutdownResponseSchema.parse(stopping)).toEqual(stopping);
  });

  test("must recognise an error response when the server refuses a request", () => {
    expect(apiErrorSchema.safeParse({ error: { message: "No thread #9", reason: "unknown-thread" } }).success).toBe(
      true
    );
  });
});
````

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test src/shared/api`
Expected: FAIL with `Cannot find module './apiRequestSchemas'` and `Cannot find module './apiResponseSchemas'`.

- [ ] **Step 4: Write the schemas**

`src/shared/api/apiRequestSchemas.ts`:

````ts
import { z } from "zod";

import { documentPathSchema } from "../review/anchorSchema";
import { messageBodySchema } from "../review/threadSchema";

export const agentOpenRequestSchema = z.strictObject({ path: documentPathSchema.optional() });

export const messageRequestSchema = z.strictObject({ body: messageBodySchema });

export const resolveRequestSchema = z.strictObject({ body: messageBodySchema.nullable() });

export const submitRequestSchema = z.strictObject({ verdict: z.enum(["request-changes", "approve"]) });

export type Verdict = z.infer<typeof submitRequestSchema>["verdict"];
````

`src/shared/api/apiResponseSchemas.ts`:

````ts
import { z } from "zod";

import type { ReviewState } from "../review/ReviewState";
import { threadSchema } from "../review/threadSchema";

const reviewStateSchema = z.strictObject({
  approved: z.boolean(),
  approvedAt: z.iso.datetime().nullable(),
  requestedAt: z.iso.datetime().nullable(),
}) satisfies z.ZodType<ReviewState>;

export const healthSchema = z.strictObject({
  name: z.literal("markdown-review"),
  pid: z.int(),
  protocol: z.int(),
  root: z.string(),
  version: z.string(),
});

export const threadsSnapshotSchema = z.strictObject({
  problems: z.array(z.string()),
  review: reviewStateSchema,
  threads: z.array(threadSchema),
});

export const pollResponseSchema = threadsSnapshotSchema.extend({ timedOut: z.boolean() });

export const agentOpenResponseSchema = z.strictObject({
  navigated: z.boolean(),
  review: reviewStateSchema,
  url: z.string(),
});

export const agentThreadResponseSchema = z.strictObject({ inbox: threadsSnapshotSchema, thread: threadSchema });

export const shutdownResponseSchema = z.strictObject({ stopping: z.literal(true) });

export const apiErrorSchema = z.strictObject({ error: z.strictObject({ message: z.string(), reason: z.string() }) });

export type Health = z.infer<typeof healthSchema>;
export type ThreadsSnapshot = z.infer<typeof threadsSnapshotSchema>;
export type PollResponse = z.infer<typeof pollResponseSchema>;
export type AgentOpenResponse = z.infer<typeof agentOpenResponseSchema>;
export type AgentThreadResponse = z.infer<typeof agentThreadResponseSchema>;
export type ShutdownResponse = z.infer<typeof shutdownResponseSchema>;
````

- [ ] **Step 5: Move `ReviewStore`'s two shared types to the schemas**

In `src/server/store/ReviewStore.ts`, add these two imports at the top of the file, before `import type { Anchor } from "../../shared/review/anchorSchema";`:

````ts
import type { Verdict } from "../../shared/api/apiRequestSchemas";
import type { ThreadsSnapshot } from "../../shared/api/apiResponseSchemas";
````

Then delete this block, which sits just after `import { toReviewState } from "./toReviewState";` (leave `export interface SubmitResult` in place):

````ts
export type Verdict = "request-changes" | "approve";

export interface ThreadsSnapshot {
  review: ReviewState;
  threads: Thread[];

  /**
   * Store files that could not be read, and so were left out
   */
  problems: string[];
}
````

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test src/shared/api`, then `pnpm verify`
Expected: 8 tests pass in `src/shared/api`; `pnpm verify` is clean with 223 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add the shared API schemas"
```

---

### Task 2: Server events, tabs and activity

**Files:**
- Create: `src/server/events/ServerEvents.ts`, `src/server/events/BrowserTabs.ts`, `src/server/runtime/ActivityMonitor.ts`, `src/server/http/RecentDocuments.ts`
- Test: `src/server/events/ServerEvents.test.ts`, `src/server/events/BrowserTabs.test.ts`, `src/server/runtime/ActivityMonitor.test.ts`, `src/server/http/RecentDocuments.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type ServerEvent = { type: "submitted" } | { type: "threads-changed" } | { type: "document-changed"; document: string } | { type: "presence"; agentWaiting: boolean }`; `class ServerEvents` with `publish(event): void` and `subscribe(listener): () => void`.
  - `interface BrowserTab { navigate(url: string): void }`; `class BrowserTabs` with `connect(tab): () => void` and `navigateLatest(url): boolean`.
  - `class ActivityMonitor` with `constructor({ events, idleMilliseconds, onIdle })`, `get agentWaiting(): boolean`, `touch(): void`, `beginBrowser(): () => void`, `beginPoll(): () => void` (publishes `presence` when the first poll begins and the last ends) and `stop(): void`. Its timer is unref'd, so it never keeps a process alive.
  - `class RecentDocuments` with `add(document): void` and `list(): string[]` (newest first, at most 10).

- [ ] **Step 1: Write the failing tests**

`src/server/events/ServerEvents.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import type { ServerEvent } from "./ServerEvents";
import { ServerEvents } from "./ServerEvents";

describe("ServerEvents", () => {
  test("must deliver each published event to every subscriber when several are subscribed", () => {
    const events = new ServerEvents();
    const first: ServerEvent[] = [];
    const second: ServerEvent[] = [];
    events.subscribe((event) => first.push(event));
    events.subscribe((event) => second.push(event));

    events.publish({ type: "submitted" });

    expect([first, second]).toEqual([[{ type: "submitted" }], [{ type: "submitted" }]]);
  });

  test("must stop delivering events to a subscriber when it unsubscribes", () => {
    const events = new ServerEvents();
    const received: ServerEvent[] = [];
    const unsubscribe = events.subscribe((event) => received.push(event));

    unsubscribe();
    events.publish({ type: "threads-changed" });

    expect(received).toEqual([]);
  });
});
````

`src/server/events/BrowserTabs.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { BrowserTabs } from "./BrowserTabs";

describe("BrowserTabs", () => {
  test("must send the page to the most recently connected tab only when several tabs are connected", () => {
    const tabs = new BrowserTabs();
    const shown: string[] = [];
    tabs.connect({ navigate: (url) => shown.push(`first ${url}`) });
    tabs.connect({ navigate: (url) => shown.push(`second ${url}`) });

    const navigated = tabs.navigateLatest("/document/docs/plan.md");

    expect(navigated).toBe(true);
    expect(shown).toEqual(["second /document/docs/plan.md"]);
  });

  test("must fall back to the earlier tab when the latest tab disconnects", () => {
    const tabs = new BrowserTabs();
    const shown: string[] = [];
    tabs.connect({ navigate: (url) => shown.push(`first ${url}`) });
    const disconnect = tabs.connect({ navigate: (url) => shown.push(`second ${url}`) });

    disconnect();
    tabs.navigateLatest("/");

    expect(shown).toEqual(["first /"]);
  });

  test("must report that nothing was shown when no tab is connected", () => {
    expect(new BrowserTabs().navigateLatest("/")).toBe(false);
  });
});
````

`src/server/runtime/ActivityMonitor.test.ts`:

````ts
import { afterEach, describe, expect, test, vi } from "vitest";

import type { ServerEvent } from "../events/ServerEvents";
import { ServerEvents } from "../events/ServerEvents";

import { ActivityMonitor } from "./ActivityMonitor";

const idleMilliseconds = 30 * 60_000;

afterEach(() => {
  vi.useRealTimers();
});

describe("ActivityMonitor", () => {
  test("must call onIdle when nothing has happened for the idle period", () => {
    const { idleCalls } = setUpTest();

    vi.advanceTimersByTime(idleMilliseconds);

    expect(idleCalls()).toBe(1);
  });

  test("must not call onIdle while a tab is connected, and start counting again when it disconnects", () => {
    const { idleCalls, monitor } = setUpTest();
    const disconnect = monitor.beginBrowser();

    vi.advanceTimersByTime(idleMilliseconds * 2);
    const whileConnected = idleCalls();
    disconnect();
    vi.advanceTimersByTime(idleMilliseconds);

    expect([whileConnected, idleCalls()]).toEqual([0, 1]);
  });

  test("must restart the countdown when a request arrives", () => {
    const { idleCalls, monitor } = setUpTest();

    vi.advanceTimersByTime(idleMilliseconds - 1);
    monitor.touch();
    vi.advanceTimersByTime(idleMilliseconds - 1);

    expect(idleCalls()).toBe(0);
  });

  test("must never call onIdle once it has been stopped", () => {
    const { idleCalls, monitor } = setUpTest();

    monitor.stop();
    vi.advanceTimersByTime(idleMilliseconds * 2);

    expect(idleCalls()).toBe(0);
  });

  test("must report the agent waiting and publish presence changes when polls begin and end", () => {
    const { monitor, published } = setUpTest();

    const endFirst = monitor.beginPoll();
    const endSecond = monitor.beginPoll();
    const waitingWithTwo = monitor.agentWaiting;
    endFirst();
    endFirst();
    endSecond();

    expect(waitingWithTwo).toBe(true);
    expect(monitor.agentWaiting).toBe(false);
    expect(published).toEqual([
      { agentWaiting: true, type: "presence" },
      { agentWaiting: false, type: "presence" },
    ]);
  });
});

function setUpTest() {
  vi.useFakeTimers();
  const events = new ServerEvents();
  const published: ServerEvent[] = [];
  events.subscribe((event) => published.push(event));
  let calls = 0;
  const monitor = new ActivityMonitor({
    events,
    idleMilliseconds,
    onIdle: () => {
      calls += 1;
    },
  });
  return { idleCalls: () => calls, monitor, published };
}
````

`src/server/http/RecentDocuments.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { RecentDocuments } from "./RecentDocuments";

describe("RecentDocuments", () => {
  test("must list docs newest first without repeats when a doc is opened again", () => {
    const recent = new RecentDocuments();

    recent.add("docs/spec.md");
    recent.add("docs/plan.md");
    recent.add("docs/spec.md");

    expect(recent.list()).toEqual(["docs/spec.md", "docs/plan.md"]);
  });

  test("must keep only the ten most recent docs when more are opened", () => {
    const recent = new RecentDocuments();

    for (let index = 1; index <= 12; index++) {
      recent.add(`docs/${index}.md`);
    }

    expect(recent.list()).toEqual(Array.from({ length: 10 }, (_, index) => `docs/${12 - index}.md`));
  });
});
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/server/events src/server/runtime src/server/http`
Expected: FAIL with `Cannot find module` for `./ServerEvents`, `./BrowserTabs`, `../events/ServerEvents` (from the activity monitor's test) and `./RecentDocuments`.

- [ ] **Step 3: Write the implementations**

`src/server/events/ServerEvents.ts`:

````ts
export type ServerEvent =
  | { type: "submitted" }
  | { type: "threads-changed" }
  | { type: "document-changed"; document: string }
  | { type: "presence"; agentWaiting: boolean };

type Listener = (event: ServerEvent) => void;

/**
 * Carries changes between the parts of the server: a submit wakes waiting polls, and the rest reach connected tabs
 */
export class ServerEvents {
  private readonly listeners = new Set<Listener>();

  public publish(event: ServerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * @returns a function that stops the listener receiving events
   */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
````

`src/server/events/BrowserTabs.ts`:

````ts
export interface BrowserTab {
  navigate(url: string): void;
}

/**
 * The browser tabs connected to the server's event stream, in the order they connected
 */
export class BrowserTabs {
  private readonly tabs: BrowserTab[] = [];

  /**
   * @returns a function that disconnects the tab
   */
  public connect(tab: BrowserTab): () => void {
    this.tabs.push(tab);
    return () => {
      const index = this.tabs.indexOf(tab);
      if (index !== -1) {
        this.tabs.splice(index, 1);
      }
    };
  }

  /**
   * Shows a page in the most recently connected tab
   *
   * @param url the page to show
   * @returns false when no tab is connected
   */
  public navigateLatest(url: string): boolean {
    const latest = this.tabs.at(-1);
    latest?.navigate(url);
    return latest !== undefined;
  }
}
````

`src/server/runtime/ActivityMonitor.ts`:

````ts
import type { ServerEvents } from "../events/ServerEvents";

export interface ActivityMonitorOptions {
  events: ServerEvents;

  /**
   * How long the server may sit with no connected tab, no waiting poll and no request before `onIdle` is called
   */
  idleMilliseconds: number;

  onIdle: () => void;
}

/**
 * Tracks connected tabs and waiting polls, reports whether the agent is waiting, and notices when the server is idle
 */
export class ActivityMonitor {
  private browsers = 0;
  private readonly events: ServerEvents;
  private readonly idleMilliseconds: number;
  private idleTimer: NodeJS.Timeout | undefined;
  private readonly onIdle: () => void;
  private polls = 0;

  public constructor({ events, idleMilliseconds, onIdle }: ActivityMonitorOptions) {
    this.events = events;
    this.idleMilliseconds = idleMilliseconds;
    this.onIdle = onIdle;
    this.restartIdleTimer();
  }

  public get agentWaiting(): boolean {
    return this.polls > 0;
  }

  /**
   * Records a request, which restarts the idle countdown
   */
  public touch(): void {
    this.restartIdleTimer();
  }

  /**
   * @returns a function to call when the tab disconnects
   */
  public beginBrowser(): () => void {
    this.browsers += 1;
    this.restartIdleTimer();
    return this.once(() => {
      this.browsers -= 1;
      this.restartIdleTimer();
    });
  }

  /**
   * @returns a function to call when the poll ends
   */
  public beginPoll(): () => void {
    this.polls += 1;
    this.restartIdleTimer();
    if (this.polls === 1) {
      this.events.publish({ agentWaiting: true, type: "presence" });
    }
    return this.once(() => {
      this.polls -= 1;
      this.restartIdleTimer();
      if (this.polls === 0) {
        this.events.publish({ agentWaiting: false, type: "presence" });
      }
    });
  }

  public stop(): void {
    clearTimeout(this.idleTimer);
  }

  private restartIdleTimer(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer =
      this.browsers === 0 && this.polls === 0 ? setTimeout(this.onIdle, this.idleMilliseconds).unref() : undefined;
  }

  private once(end: () => void): () => void {
    let ended = false;
    return () => {
      if (!ended) {
        ended = true;
        end();
      }
    };
  }
}
````

`src/server/http/RecentDocuments.ts`:

````ts
const recentLimit = 10;

/**
 * The docs most recently opened by the agent or shown in a browser, newest first
 */
export class RecentDocuments {
  private documents: string[] = [];

  public add(document: string): void {
    this.documents = [document, ...this.documents.filter((existing) => existing !== document)].slice(0, recentLimit);
  }

  public list(): string[] {
    return [...this.documents];
  }
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/server/events src/server/runtime src/server/http`, then `pnpm verify`
Expected: 12 tests pass; `pnpm verify` is clean with 235 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the server's event bus, tab registry and activity monitor"
```

---

### Task 3: Repo path confinement, the preferred port and private files

**Files:**
- Create: `src/server/files/resolveRepositoryPath.ts`, `src/server/runtime/preferredPort.ts`
- Modify: `src/server/files/writeJsonAtomically.ts` (optional file mode)
- Test: `src/server/files/resolveRepositoryPath.test.ts`, `src/server/runtime/preferredPort.test.ts`, `src/server/files/writeJsonAtomically.test.ts` (one test added)

**Interfaces:**
- Consumes: `isRepositoryRelativePath` (plan 1), `isFileNotFound` and `setUpTemporaryDirectory` (plan 1).
- Produces:
  - `type RepositoryPath = { kind: "inside"; absolutePath: string } | { kind: "invalid" } | { kind: "missing" } | { kind: "outside" }`; `resolveRepositoryPath(root: string, relativePath: string): Promise<RepositoryPath>`.
  - `preferredPort(root: string): number`.
  - `writeJsonAtomically(filePath: string, value: unknown, mode?: number): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`src/server/files/resolveRepositoryPath.test.ts`:

````ts
import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { resolveRepositoryPath } from "./resolveRepositoryPath";

const getDirectory = setUpTemporaryDirectory();

describe("resolveRepositoryPath", () => {
  test("must return the real path when the file is inside the repo", async () => {
    const { root } = await setUpTest();

    const resolved = await resolveRepositoryPath(root, "docs/plan.md");

    expect(resolved).toMatchObject({ kind: "inside" });
    expect(resolved.kind === "inside" && resolved.absolutePath.endsWith(path.join("docs", "plan.md"))).toBe(true);
  });

  test("must report the file missing when nothing exists at the path", async () => {
    const { root } = await setUpTest();

    expect(await resolveRepositoryPath(root, "docs/missing.md")).toEqual({ kind: "missing" });
  });

  test("must refuse the path when it climbs out of the repo", async () => {
    const { root } = await setUpTest();

    expect(await resolveRepositoryPath(root, "../secret.md")).toEqual({ kind: "invalid" });
  });

  test("must refuse the path when a symlink inside the repo leads out of it", async () => {
    const { root } = await setUpTest();
    await symlink(path.join(getDirectory(), "secret.md"), path.join(root, "docs", "linked.md"));

    expect(await resolveRepositoryPath(root, "docs/linked.md")).toEqual({ kind: "outside" });
  });
});

async function setUpTest() {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  await writeFile(path.join(getDirectory(), "secret.md"), "secret\n");
  return { root };
}
````

`src/server/runtime/preferredPort.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { preferredPort } from "./preferredPort";

describe("preferredPort", () => {
  test("must return the same dynamic-range port when asked twice for the same root", () => {
    const port = preferredPort("/Users/someone/repo");

    expect(preferredPort("/Users/someone/repo")).toBe(port);
    expect(port).toBeGreaterThanOrEqual(49152);
    expect(port).toBeLessThanOrEqual(65535);
  });

  test("must return different ports when the roots differ", () => {
    expect(preferredPort("/Users/someone/repo")).not.toBe(preferredPort("/Users/someone/other"));
  });
});
````

Replace `src/server/files/writeJsonAtomically.test.ts` with (the last test is new):

````ts
import { open, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { writeJsonAtomically } from "./writeJsonAtomically";

const getDirectory = setUpTemporaryDirectory();

describe("writeJsonAtomically", () => {
  test("must write formatted JSON and leave no temporary file when the directory does not exist yet", async () => {
    const filePath = path.join(getDirectory(), "nested", "value.json");

    await writeJsonAtomically(filePath, { answer: 42 });

    expect(await readFile(filePath, "utf8")).toBe('{\n  "answer": 42\n}\n');
    expect(await readdir(path.dirname(filePath))).toEqual(["value.json"]);
  });

  test("must replace the previous contents and leave no temporary file when the file already exists", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, "old");

    await writeJsonAtomically(filePath, { answer: 42 });

    expect(await readFile(filePath, "utf8")).toBe('{\n  "answer": 42\n}\n');
    expect(await readdir(getDirectory())).toEqual(["value.json"]);
  });

  test("must keep the old contents for a reader that already opened the file when the file is replaced", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, "old");
    const reader = await open(filePath);

    await writeJsonAtomically(filePath, { answer: 42 });

    const contentsSeenByReader = await reader.readFile("utf8");
    await reader.close();
    expect(contentsSeenByReader).toBe("old");
  });

  test("must leave the existing file untouched and no temporary file when the value cannot be serialised", async () => {
    const filePath = path.join(getDirectory(), "value.json");
    await writeFile(filePath, "old");

    await expect(writeJsonAtomically(filePath, { answer: 42n })).rejects.toThrow(TypeError);

    expect(await readFile(filePath, "utf8")).toBe("old");
    expect(await readdir(getDirectory())).toEqual(["value.json"]);
  });

  test("must give the file the requested permissions when a mode is passed", async () => {
    const filePath = path.join(getDirectory(), "secret.json");

    await writeJsonAtomically(filePath, { token: "abc" }, 0o600);

    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });
});
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/server/files src/server/runtime/preferredPort.test.ts`
Expected: FAIL with `Cannot find module './resolveRepositoryPath'` and `Cannot find module './preferredPort'`, and "must give the file the requested permissions when a mode is passed" fails with `expected 420 to be 384`, because the file gets the default mode.

- [ ] **Step 3: Write the implementations**

`src/server/files/resolveRepositoryPath.ts`:

````ts
import { realpath } from "node:fs/promises";
import path from "node:path";

import { isRepositoryRelativePath } from "../../shared/review/isRepositoryRelativePath";

import { isFileNotFound } from "./isFileNotFound";

export type RepositoryPath =
  | { kind: "inside"; absolutePath: string }
  | { kind: "invalid" }
  | { kind: "missing" }
  | { kind: "outside" };

/**
 * Finds a file in the repo from its repo-relative path
 *
 * @param root the repo root
 * @param relativePath a repo-relative POSIX path, e.g. "docs/plan.md"
 * @returns the file's real path when it is inside the repo; "outside" when it, or a symlink on the way, leads out of
 *   the repo; "missing" when nothing exists there; "invalid" when the path is not repo-relative
 */
export async function resolveRepositoryPath(root: string, relativePath: string): Promise<RepositoryPath> {
  if (!isRepositoryRelativePath(relativePath)) {
    return { kind: "invalid" };
  }
  let absolutePath: string;
  try {
    absolutePath = await realpath(path.join(root, ...relativePath.split("/")));
  } catch (error) {
    if (isFileNotFound(error) || isNotDirectory(error)) {
      return { kind: "missing" };
    }
    throw error;
  }
  const realRoot = await realpath(root);
  const isInside = absolutePath.startsWith(realRoot + path.sep);
  return isInside ? { absolutePath, kind: "inside" } : { kind: "outside" };
}

function isNotDirectory(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOTDIR";
}
````

`src/server/runtime/preferredPort.ts`:

````ts
import { createHash } from "node:crypto";

const firstDynamicPort = 49152;

const dynamicPortCount = 16384;

/**
 * Picks the port a root's server tries first, so a restarted server usually comes back on the same port
 *
 * @param root the repo root
 * @returns a port in the dynamic range 49152-65535, the same for the same root
 */
export function preferredPort(root: string): number {
  const digest = createHash("sha256").update(root, "utf8").digest();
  return firstDynamicPort + (digest.readUInt32BE(0) % dynamicPortCount);
}
````

Replace `src/server/files/writeJsonAtomically.ts` with:

````ts
import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Writes a value as formatted JSON so readers see either the old file or the new one, never half of it
 *
 * @param filePath the file to write; missing parent directories are created
 * @param value the value to serialise
 * @param mode the file's permissions, e.g. 0o600 to keep other users out; the platform default when omitted
 */
export async function writeJsonAtomically(filePath: string, value: unknown, mode?: number): Promise<void> {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode });
  await rename(temporaryPath, filePath);
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/server/files src/server/runtime/preferredPort.test.ts`, then `pnpm verify`
Expected: all pass; `pnpm verify` is clean with 242 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Confine repo paths, pick a preferred port and write private files"
```

---

### Task 4: The HTTP app core: security, health, repo files and the app shell

**Files:**
- Create: `src/shared/api/protocolVersion.ts`, `src/server/http/HttpError.ts`, `AppDependencies.ts`, `securityMiddleware.ts`, `healthRoutes.ts`, `fileRoutes.ts`, `contentTypeFor.ts`, `shellRoutes.ts`, `createApp.ts`, `testing/setUpAppTest.ts` (all but the first in `src/server/http/`)
- Test: `src/server/http/securityMiddleware.test.ts`, `healthRoutes.test.ts`, `fileRoutes.test.ts`, `shellRoutes.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3 (`Health`, `ServerEvents`, `BrowserTabs`, `ActivityMonitor`, `RecentDocuments`, `resolveRepositoryPath`); plan 1's `ReviewStore`, `StoreError`, `Logger`, `createMemoryLogger`.
- Produces:
  - `protocolVersion = 1`.
  - `class HttpError extends Error { readonly reason: string; readonly status: ContentfulStatusCode }`.
  - `interface AppDependencies { activity; events; logger; pollKeepAliveMilliseconds; port: () => number; recentDocuments; root; shutdown: () => void; store; tabs; token; version; watchDocument: (document: string) => void }`.
  - `requireLocalHost(port)`, `requireAgentToken(token)`, `requireBrowserOrigin(port)` (Hono middleware).
  - `createApp(dependencies: AppDependencies): Hono`. It maps `HttpError` and `StoreError` to `{ error: { message, reason } }` with statuses `invalid-file` 500, `invalid-input` 400, `invalid-state` 409, `missing-document` 404, `unknown-thread` 404. In this task it registers the health, file and shell routes.
  - `registerHealthRoutes`, `registerFileRoutes`, `registerShellRoutes`, `contentTypeFor(filePath): string`.
  - Test harness `setUpAppTest(directory)`: a repo holding `docs/plan.md`, an initialized store, and `request`, `browser` and `agent` helpers. Also `testPort = 4321`, `testToken`, `testPlan`.

- [ ] **Step 1: Add Hono**

```bash
pnpm add hono
pnpm format
```

- [ ] **Step 2: Write the test harness and the failing tests**

`src/server/http/testing/setUpAppTest.ts`:

````ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { BrowserTabs } from "../../events/BrowserTabs";
import type { ServerEvent } from "../../events/ServerEvents";
import { ServerEvents } from "../../events/ServerEvents";
import { createMemoryLogger } from "../../logging/testing/createMemoryLogger";
import { ActivityMonitor } from "../../runtime/ActivityMonitor";
import { ReviewStore } from "../../store/ReviewStore";
import { createApp } from "../createApp";
import { RecentDocuments } from "../RecentDocuments";

export const testPort = 4321;

export const testToken = "a".repeat(64);

export const testPlan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

/**
 * Builds the app over a fresh repo in `directory`, holding `docs/plan.md`, with helpers that send requests the way
 * the CLI and the browser do
 */
export async function setUpAppTest(directory: string) {
  const root = path.join(directory, "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), testPlan);
  const { entries, logger } = createMemoryLogger();
  const store = new ReviewStore(root, logger);
  await store.initialize();
  const events = new ServerEvents();
  const published: ServerEvent[] = [];
  events.subscribe((event) => published.push(event));
  const tabs = new BrowserTabs();
  const activity = new ActivityMonitor({ events, idleMilliseconds: 60 * 60_000, onIdle: () => {} });
  const watched: string[] = [];
  const recentDocuments = new RecentDocuments();
  let shutdowns = 0;
  const app = createApp({
    activity,
    events,
    logger,
    pollKeepAliveMilliseconds: 50,
    port: () => testPort,
    recentDocuments,
    root,
    shutdown: () => {
      shutdowns += 1;
    },
    store,
    tabs,
    token: testToken,
    version: "0.0.0-test",
    watchDocument: (document) => watched.push(document),
  });
  const request = (method: string, url: string, headers: Record<string, string>, body?: unknown) =>
    app.request(`http://127.0.0.1:${testPort}${url}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { host: `127.0.0.1:${testPort}`, ...headers },
      method,
    });
  const browser = (method: string, url: string, body?: unknown) =>
    request(method, url, { "content-type": "application/json", origin: `http://127.0.0.1:${testPort}` }, body);
  const agent = (method: string, url: string, body?: unknown) =>
    request(method, url, { authorization: `Bearer ${testToken}`, "content-type": "application/json" }, body);
  return {
    activity,
    agent,
    browser,
    entries,
    published,
    recentDocuments,
    request,
    root,
    shutdownCount: () => shutdowns,
    store,
    tabs,
    watched,
  };
}
````

`src/server/http/securityMiddleware.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { setUpAppTest, testPort, testToken } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("securityMiddleware", () => {
  test("must refuse a request when its Host header names another server", async () => {
    const { request } = await setUpTest();

    const response = await request("GET", "/api/health", { host: `evil.example:${testPort}` });

    expect(response.status).toBe(403);
  });

  test("must refuse an agent route when the request has no token", async () => {
    const { request } = await setUpTest();

    expect((await request("GET", "/api/inbox", {})).status).toBe(401);
  });

  test("must refuse an agent route when the request carries an Origin header, even with the token", async () => {
    const { request } = await setUpTest();

    const response = await request("GET", "/api/inbox", {
      authorization: `Bearer ${testToken}`,
      origin: `http://127.0.0.1:${testPort}`,
    });

    expect(response.status).toBe(403);
  });

  test("must refuse a browser change when it comes from another origin", async () => {
    const { request } = await setUpTest();

    const response = await request(
      "POST",
      "/api/submit",
      { "content-type": "application/json", origin: "http://evil.example" },
      { verdict: "approve" }
    );

    expect(response.status).toBe(403);
  });

  test("must refuse a browser change when it is not sent as JSON, as an HTML form would send it", async () => {
    const { request } = await setUpTest();

    const response = await request(
      "POST",
      "/api/submit",
      { "content-type": "application/x-www-form-urlencoded", origin: `http://127.0.0.1:${testPort}` },
      { verdict: "approve" }
    );

    expect(response.status).toBe(415);
  });
});

function setUpTest() {
  return setUpAppTest(getDirectory());
}
````

`src/server/http/healthRoutes.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { healthSchema } from "../../shared/api/apiResponseSchemas";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("healthRoutes", () => {
  test("must report the server's name, protocol and root when the CLI checks its health", async () => {
    const { request, root } = await setUpAppTest(getDirectory());

    const health = healthSchema.parse(await (await request("GET", "/api/health", {})).json());

    expect(health).toEqual({ name: "markdown-review", pid: process.pid, protocol: 1, root, version: "0.0.0-test" });
  });
});
````

`src/server/http/fileRoutes.test.ts`:

````ts
import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { setUpAppTest, testPlan } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("fileRoutes", () => {
  test("must serve a repo image with its type and the sandbox headers when a doc links to it", async () => {
    const { request, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(root, "docs", "diagram.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const response = await request("GET", "/files/docs/diagram.png", {});

    expect(response.status).toBe(200);
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-security-policy": "sandbox",
      "content-type": "image/png",
      "x-content-type-options": "nosniff",
    });
  });

  test("must serve a doc's raw markdown as markdown when a doc links to another doc's file", async () => {
    const { request } = await setUpAppTest(getDirectory());

    const response = await request("GET", "/files/docs/plan.md", {});

    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    expect(await response.text()).toBe(testPlan);
  });

  test("must find the file when its name has spaces and the link encodes them", async () => {
    const { request, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(root, "docs", "Flow Chart.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect((await request("GET", "/files/docs/Flow%20Chart.png", {})).status).toBe(200);
  });

  test("must serve an HTML file sandboxed so its script cannot run on the server's origin", async () => {
    const { request, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(root, "docs", "demo.html"), "<script>fetch('/api/submit')</script>");

    const response = await request("GET", "/files/docs/demo.html", {});

    expect(response.headers.get("content-security-policy")).toBe("sandbox");
  });

  test("must refuse a file when a symlink in the repo leads out of it", async () => {
    const { request, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(getDirectory(), "secret.txt"), "secret\n");
    await symlink(path.join(getDirectory(), "secret.txt"), path.join(root, "docs", "secret.txt"));

    expect((await request("GET", "/files/docs/secret.txt", {})).status).toBe(403);
  });

  test.each([
    { condition: "nothing exists at the path", setUp: async () => {} },
    {
      condition: "the path is a directory",
      setUp: async (root: string) => mkdir(path.join(root, "docs", "missing.png"), { recursive: true }),
    },
  ])("must answer 404 when $condition", async ({ setUp }) => {
    const { request, root } = await setUpAppTest(getDirectory());
    await setUp(root);

    expect((await request("GET", "/files/docs/missing.png", {})).status).toBe(404);
  });
});
````

`src/server/http/shellRoutes.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("shellRoutes", () => {
  test("must serve the page with a policy that only runs scripts from the server when a doc URL is opened", async () => {
    const { request } = await setUpAppTest(getDirectory());

    const response = await request("GET", "/document/docs/plan.md", {});

    expect(response.headers.get("content-type")).toBe("text/html; charset=UTF-8");
    expect(response.headers.get("content-security-policy")).toContain("script-src 'self'");
    expect(await response.text()).toContain("<title>Markdown Review</title>");
  });
});
````

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test src/server/http`
Expected: the four new files FAIL with `Cannot find module '../createApp'` (from the harness).

- [ ] **Step 4: Write the protocol version, errors, dependencies and middleware**

`src/shared/api/protocolVersion.ts`:

````ts
/**
 * The version of the HTTP API and the store format; bumped whenever either changes incompatibly
 */
export const protocolVersion = 1;
````

`src/server/http/HttpError.ts`:

````ts
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
````

`src/server/http/AppDependencies.ts`:

````ts
import type { BrowserTabs } from "../events/BrowserTabs";
import type { ServerEvents } from "../events/ServerEvents";
import type { Logger } from "../logging/Logger";
import type { ActivityMonitor } from "../runtime/ActivityMonitor";
import type { ReviewStore } from "../store/ReviewStore";

import type { RecentDocuments } from "./RecentDocuments";

export interface AppDependencies {
  activity: ActivityMonitor;
  events: ServerEvents;
  logger: Logger;

  /**
   * How often a waiting poll writes a space to keep its connection alive
   */
  pollKeepAliveMilliseconds: number;

  /**
   * The port the server listens on
   */
  port: () => number;

  recentDocuments: RecentDocuments;
  root: string;
  shutdown: () => void;
  store: ReviewStore;
  tabs: BrowserTabs;

  /**
   * The secret agent routes require, from `server.json`
   */
  token: string;

  version: string;

  /**
   * Starts watching a doc for edits, so connected tabs hear about them
   */
  watchDocument: (document: string) => void;
}
````

`src/server/http/securityMiddleware.ts`:

````ts
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
    const allowedOrigins = [`http://127.0.0.1:${port()}`, `http://localhost:${port()}`];
    if (!allowedOrigins.includes(context.req.header("origin") ?? "")) {
      throw new HttpError(403, "forbidden", "Changes must come from this server's own pages");
    }
    if (!(context.req.header("content-type") ?? "").startsWith("application/json")) {
      throw new HttpError(415, "unsupported-media-type", "Changes must be sent as application/json");
    }
    await next();
  };
}

function isExpectedToken(authorization: string | undefined, token: string): boolean {
  const expected = Buffer.from(`Bearer ${token}`);
  const actual = Buffer.from(authorization ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
````

- [ ] **Step 5: Write the routes and `createApp`**

`src/server/http/healthRoutes.ts`:

````ts
import type { Hono } from "hono";

import type { Health } from "../../shared/api/apiResponseSchemas";
import { protocolVersion } from "../../shared/api/protocolVersion";

import type { AppDependencies } from "./AppDependencies";

export function registerHealthRoutes(app: Hono, { root, version }: AppDependencies): void {
  app.get("/api/health", (context) => {
    const health: Health = { name: "markdown-review", pid: process.pid, protocol: protocolVersion, root, version };
    return context.json(health);
  });
}
````

`src/server/http/contentTypeFor.ts`:

````ts
import path from "node:path";

const contentTypes: Partial<Record<string, string>> = {
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

/**
 * Picks the Content-Type for a repo file from its extension
 *
 * @param filePath the file's path
 * @returns the media type, or application/octet-stream for an extension it does not know
 */
export function contentTypeFor(filePath: string): string {
  return contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}
````

`src/server/http/fileRoutes.ts`:

````ts
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
````

`src/server/http/shellRoutes.ts`:

````ts
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
````

`src/server/http/createApp.ts`:

````ts
import { Hono } from "hono";

import type { StoreErrorReason } from "../store/StoreError";
import { StoreError } from "../store/StoreError";

import type { AppDependencies } from "./AppDependencies";
import { registerFileRoutes } from "./fileRoutes";
import { registerHealthRoutes } from "./healthRoutes";
import { HttpError } from "./HttpError";
import { requireAgentToken, requireBrowserOrigin, requireLocalHost } from "./securityMiddleware";
import { registerShellRoutes } from "./shellRoutes";

const statusForStoreError = {
  "invalid-file": 500,
  "invalid-input": 400,
  "invalid-state": 409,
  "missing-document": 404,
  "unknown-thread": 404,
} as const satisfies Record<StoreErrorReason, number>;

/**
 * Builds the server's HTTP app: the agent's API, the browser's API, the event stream, repo files and the app shell
 *
 * @param dependencies the store and the server's shared state
 * @returns the app, ready to be served on 127.0.0.1
 */
export function createApp(dependencies: AppDependencies): Hono {
  const { activity, logger, port, token } = dependencies;
  const app = new Hono();
  app.use("*", requireLocalHost(port));
  app.use("*", async (_context, next) => {
    activity.touch();
    await next();
  });
  for (const agentPath of ["/api/agent/*", "/api/inbox", "/api/poll", "/api/shutdown"]) {
    app.use(agentPath, requireAgentToken(token));
  }
  for (const browserPath of ["/api/threads", "/api/threads/*", "/api/submit"]) {
    app.use(browserPath, requireBrowserOrigin(port));
  }
  app.onError((error, context) => {
    if (error instanceof HttpError) {
      return context.json({ error: { message: error.message, reason: error.reason } }, error.status);
    }
    if (error instanceof StoreError) {
      return context.json(
        { error: { message: error.message, reason: error.reason } },
        statusForStoreError[error.reason]
      );
    }
    logger.error(`${context.req.method} ${context.req.path} failed`, error);
    return context.json(
      {
        error: {
          message: "The server failed to handle the request; see .markdown-review/server.log",
          reason: "internal",
        },
      },
      500
    );
  });
  registerHealthRoutes(app, dependencies);
  registerFileRoutes(app, dependencies);
  registerShellRoutes(app);
  return app;
}
````

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm test src/server/http`, then `pnpm verify`
Expected: all pass, including the Review Focus test "must find the file when its name has spaces and the link encodes them"; `pnpm verify` is clean with 256 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add the HTTP app with its security checks, health, repo files and shell"
```

---

### Task 5: Browser routes

**Files:**
- Create: `src/server/http/requestInputs.ts`, `src/server/http/browserRoutes.ts`
- Modify: `src/server/http/createApp.ts` (register the browser routes), `src/server/http/testing/setUpAppTest.ts` (add `cacheComment`)
- Test: `src/server/http/browserRoutes.test.ts`

**Interfaces:**
- Consumes: Task 4's app and harness; Task 1's `messageRequestSchema` and `submitRequestSchema`; plan 1's `newThreadSchema`, `hashSource`, `parseStoreInput`.
- Produces:
  - `readJsonBody(context, schema)`, `readThreadId(context): number`, and `checkDocumentPath(root, document, allowMissing): Promise<void>`, which throws `HttpError` 400 `invalid-input`, 403 `outside-root` or 404 `missing-document`.
  - Routes:
    - `GET /api/documents`
    - `GET /api/document?path=` (records the doc as recent and watches it)
    - `GET /api/threads?document=|?all=1`
    - `POST /api/threads` (201 `{ thread }`)
    - `PUT` and `DELETE /api/threads/:id/draft`
    - `POST /api/threads/:id/resolve`
    - `POST /api/submit` (publishes `submitted` then `threads-changed`)
  - Every change publishes `threads-changed`.
  - Harness export `cacheComment`: the comment the browser sends for "cache results for 24h" in `testPlan`.

- [ ] **Step 1: Write the failing tests**

Replace `src/server/http/testing/setUpAppTest.ts` with (only `cacheComment` at the end is new):

````ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { BrowserTabs } from "../../events/BrowserTabs";
import type { ServerEvent } from "../../events/ServerEvents";
import { ServerEvents } from "../../events/ServerEvents";
import { createMemoryLogger } from "../../logging/testing/createMemoryLogger";
import { ActivityMonitor } from "../../runtime/ActivityMonitor";
import { ReviewStore } from "../../store/ReviewStore";
import { createApp } from "../createApp";
import { RecentDocuments } from "../RecentDocuments";

export const testPort = 4321;

export const testToken = "a".repeat(64);

export const testPlan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

/**
 * Builds the app over a fresh repo in `directory`, holding `docs/plan.md`, with helpers that send requests the way
 * the CLI and the browser do
 */
export async function setUpAppTest(directory: string) {
  const root = path.join(directory, "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), testPlan);
  const { entries, logger } = createMemoryLogger();
  const store = new ReviewStore(root, logger);
  await store.initialize();
  const events = new ServerEvents();
  const published: ServerEvent[] = [];
  events.subscribe((event) => published.push(event));
  const tabs = new BrowserTabs();
  const activity = new ActivityMonitor({ events, idleMilliseconds: 60 * 60_000, onIdle: () => {} });
  const watched: string[] = [];
  const recentDocuments = new RecentDocuments();
  let shutdowns = 0;
  const app = createApp({
    activity,
    events,
    logger,
    pollKeepAliveMilliseconds: 50,
    port: () => testPort,
    recentDocuments,
    root,
    shutdown: () => {
      shutdowns += 1;
    },
    store,
    tabs,
    token: testToken,
    version: "0.0.0-test",
    watchDocument: (document) => watched.push(document),
  });
  const request = (method: string, url: string, headers: Record<string, string>, body?: unknown) =>
    app.request(`http://127.0.0.1:${testPort}${url}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { host: `127.0.0.1:${testPort}`, ...headers },
      method,
    });
  const browser = (method: string, url: string, body?: unknown) =>
    request(method, url, { "content-type": "application/json", origin: `http://127.0.0.1:${testPort}` }, body);
  const agent = (method: string, url: string, body?: unknown) =>
    request(method, url, { authorization: `Bearer ${testToken}`, "content-type": "application/json" }, body);
  return {
    activity,
    agent,
    browser,
    entries,
    published,
    recentDocuments,
    request,
    root,
    shutdownCount: () => shutdowns,
    store,
    tabs,
    watched,
  };
}

/**
 * The comment the browser sends when the user selects "cache results for 24h" in the test plan
 */
export const cacheComment = {
  anchor: {
    document: "docs/plan.md",
    endOffset: 29,
    kind: "passage",
    prefix: "Plan\nWe ",
    quote: "cache results for 24h",
    startOffset: 8,
    suffix: ".\nRetries happen three times.",
  },
  body: "Why 24h?",
};
````

`src/server/http/browserRoutes.test.ts`:

````ts
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
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/server/http/browserRoutes.test.ts`
Expected: FAIL. The routes are not registered yet, so the requests answer 404 (for example `expected 404 to be 201`).

- [ ] **Step 3: Write the request helpers and the browser routes**

`src/server/http/requestInputs.ts`:

````ts
import type { Context } from "hono";
import type { ZodType } from "zod";

import { resolveRepositoryPath } from "../files/resolveRepositoryPath";
import { parseStoreInput } from "../store/parseStoreInput";

import { HttpError } from "./HttpError";

/**
 * Reads and validates a JSON request body
 *
 * @throws StoreError "invalid-input" when the body is not JSON or does not have the schema's shape
 */
export async function readJsonBody<Value>(context: Context, schema: ZodType<Value>): Promise<Value> {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    body = undefined;
  }
  return parseStoreInput(schema, body, "The request body");
}

/**
 * Reads the `:id` route parameter
 *
 * @throws HttpError 400 when it is not a positive whole number
 */
export function readThreadId(context: Context): number {
  const id = context.req.param("id") ?? "";
  if (!/^[1-9][0-9]*$/.test(id)) {
    throw new HttpError(400, "invalid-input", `"${id}" is not a thread ID`);
  }
  return Number(id);
}

/**
 * Checks that a doc path from a request stays inside the repo
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path
 * @param allowMissing whether a doc that no longer exists is acceptable, as it is when reading its threads
 * @throws HttpError 400 for a path that is not repo-relative, 403 for one that leads out of the repo, and 404 for a
 *   missing doc unless `allowMissing` is set
 */
export async function checkDocumentPath(root: string, document: string, allowMissing: boolean): Promise<void> {
  const resolved = await resolveRepositoryPath(root, document);
  switch (resolved.kind) {
    case "invalid":
      throw new HttpError(400, "invalid-input", `${document} is not a repo-relative path`);
    case "outside":
      throw new HttpError(403, "outside-root", `${document} leads outside the repo`);
    case "missing":
      if (!allowMissing) {
        throw new HttpError(404, "missing-document", `${document} does not exist`);
      }
      return;
    case "inside":
      return;
  }
}
````

`src/server/http/browserRoutes.ts`:

````ts
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Hono } from "hono";

import { messageRequestSchema, submitRequestSchema } from "../../shared/api/apiRequestSchemas";
import { newThreadSchema } from "../../shared/review/newThreadSchema";
import type { Thread } from "../../shared/review/threadSchema";
import { hashSource } from "../store/hashSource";

import type { AppDependencies } from "./AppDependencies";
import { HttpError } from "./HttpError";
import { checkDocumentPath, readJsonBody, readThreadId } from "./requestInputs";

export function registerBrowserRoutes(app: Hono, dependencies: AppDependencies): void {
  const { events, recentDocuments, root, store, watchDocument } = dependencies;
  const threadsChanged = (): void => events.publish({ type: "threads-changed" });

  app.get("/api/documents", async (context) => {
    const { problems, threads } = await store.readThreads(null);
    return context.json({ documents: countByDocument(threads), problems, recent: recentDocuments.list() });
  });

  app.get("/api/document", async (context) => {
    const document = context.req.query("path") ?? "";
    await checkDocumentPath(root, document, false);
    const source = await readFile(path.join(root, ...document.split("/")), "utf8");
    recentDocuments.add(document);
    watchDocument(document);
    return context.json({ hash: hashSource(source), path: document, source });
  });

  app.get("/api/threads", async (context) => {
    const document = context.req.query("document");
    if (document === undefined && context.req.query("all") !== "1") {
      throw new HttpError(400, "invalid-input", "Pass ?document=<path> or ?all=1");
    }
    if (document !== undefined) {
      await checkDocumentPath(root, document, true);
      watchDocument(document);
    }
    return context.json(await store.readThreads(document ?? null));
  });

  app.post("/api/threads", async (context) => {
    const newThread = await readJsonBody(context, newThreadSchema);
    if (newThread.anchor.kind !== "review") {
      await checkDocumentPath(root, newThread.anchor.document, false);
      watchDocument(newThread.anchor.document);
    }
    const thread = await store.createDraftThread(newThread);
    threadsChanged();
    return context.json({ thread }, 201);
  });

  app.put("/api/threads/:id/draft", async (context) => {
    const { body } = await readJsonBody(context, messageRequestSchema);
    const thread = await store.writeDraft(readThreadId(context), body);
    threadsChanged();
    return context.json({ thread });
  });

  app.delete("/api/threads/:id/draft", async (context) => {
    const thread = await store.deleteDraft(readThreadId(context));
    threadsChanged();
    return context.json({ thread });
  });

  app.post("/api/threads/:id/resolve", async (context) => {
    const thread = await store.resolveAsUser(readThreadId(context));
    threadsChanged();
    return context.json({ thread });
  });

  app.post("/api/submit", async (context) => {
    const { verdict } = await readJsonBody(context, submitRequestSchema);
    const result = await store.submit(verdict);
    events.publish({ type: "submitted" });
    threadsChanged();
    return context.json(result);
  });
}

function countByDocument(threads: readonly Thread[]): { document: string; draftCount: number; openCount: number }[] {
  const counts = new Map<string, { draftCount: number; openCount: number }>();
  for (const thread of threads) {
    if (thread.anchor.kind === "review") {
      continue;
    }
    const count = counts.get(thread.anchor.document) ?? { draftCount: 0, openCount: 0 };
    counts.set(thread.anchor.document, {
      draftCount: count.draftCount + (thread.draft === undefined ? 0 : 1),
      openCount: count.openCount + (thread.status === "open" ? 1 : 0),
    });
  }
  return [...counts]
    .filter(([, count]) => count.draftCount + count.openCount > 0)
    .map(([document, count]) => ({ document, ...count }))
    .sort((left, right) => left.document.localeCompare(right.document));
}
````

Replace `src/server/http/createApp.ts` with:

````ts
import { Hono } from "hono";

import type { StoreErrorReason } from "../store/StoreError";
import { StoreError } from "../store/StoreError";

import type { AppDependencies } from "./AppDependencies";
import { registerBrowserRoutes } from "./browserRoutes";
import { registerFileRoutes } from "./fileRoutes";
import { registerHealthRoutes } from "./healthRoutes";
import { HttpError } from "./HttpError";
import { requireAgentToken, requireBrowserOrigin, requireLocalHost } from "./securityMiddleware";
import { registerShellRoutes } from "./shellRoutes";

const statusForStoreError = {
  "invalid-file": 500,
  "invalid-input": 400,
  "invalid-state": 409,
  "missing-document": 404,
  "unknown-thread": 404,
} as const satisfies Record<StoreErrorReason, number>;

/**
 * Builds the server's HTTP app: the agent's API, the browser's API, the event stream, repo files and the app shell
 *
 * @param dependencies the store and the server's shared state
 * @returns the app, ready to be served on 127.0.0.1
 */
export function createApp(dependencies: AppDependencies): Hono {
  const { activity, logger, port, token } = dependencies;
  const app = new Hono();
  app.use("*", requireLocalHost(port));
  app.use("*", async (_context, next) => {
    activity.touch();
    await next();
  });
  for (const agentPath of ["/api/agent/*", "/api/inbox", "/api/poll", "/api/shutdown"]) {
    app.use(agentPath, requireAgentToken(token));
  }
  for (const browserPath of ["/api/threads", "/api/threads/*", "/api/submit"]) {
    app.use(browserPath, requireBrowserOrigin(port));
  }
  app.onError((error, context) => {
    if (error instanceof HttpError) {
      return context.json({ error: { message: error.message, reason: error.reason } }, error.status);
    }
    if (error instanceof StoreError) {
      return context.json(
        { error: { message: error.message, reason: error.reason } },
        statusForStoreError[error.reason]
      );
    }
    logger.error(`${context.req.method} ${context.req.path} failed`, error);
    return context.json(
      {
        error: {
          message: "The server failed to handle the request; see .markdown-review/server.log",
          reason: "internal",
        },
      },
      500
    );
  });
  registerHealthRoutes(app, dependencies);
  registerBrowserRoutes(app, dependencies);
  registerFileRoutes(app, dependencies);
  registerShellRoutes(app);
  return app;
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/server/http`, then `pnpm verify`
Expected: 11 `browserRoutes` tests pass; `pnpm verify` is clean with 267 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the browser's API routes"
```

---

### Task 6: Agent routes and the waiting poll

**Files:**
- Create: `src/server/http/agentRoutes.ts`, `src/server/http/pollRoutes.ts`, `src/server/http/waitForInbox.ts`
- Modify: `src/server/http/createApp.ts` (register the agent and poll routes)
- Test: `src/server/http/agentRoutes.test.ts`, `src/server/http/pollRoutes.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 4 and 5 (schemas, app, `checkDocumentPath`, `readJsonBody`, `readThreadId`, the harness and `cacheComment`).
- Produces:
  - `POST /api/shutdown` (`{ stopping: true }`, then `shutdown()` after 100 ms).
  - `POST /api/agent/open` (`{ path? }` → `{ navigated, review, url }`; sets `requestedAt`, navigates the latest tab, records and watches the doc).
  - `GET /api/inbox?document=`.
  - `POST /api/agent/threads/:id/reply` and `/resolve` (→ `{ inbox, thread }`).
  - `GET /api/poll?document=&timeout=` (seconds, default 540, at most 86400; streams keep-alive spaces, then the `PollResponse` JSON).
  - `waitForInbox({ document, events, signal, store, timeoutMilliseconds }): Promise<PollResponse>`.

- [ ] **Step 1: Write the failing tests**

`src/server/http/agentRoutes.test.ts`:

````ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

import { agentOpenResponseSchema, agentThreadResponseSchema } from "../../shared/api/apiResponseSchemas";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { cacheComment, setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("agentRoutes", () => {
  test("must start a round and return the doc's URL without navigating when no tab is connected", async () => {
    const { agent, recentDocuments } = await setUpAppTest(getDirectory());

    const response = agentOpenResponseSchema.parse(
      await (await agent("POST", "/api/agent/open", { path: "docs/plan.md" })).json()
    );

    expect(response).toMatchObject({ navigated: false, url: "http://127.0.0.1:4321/document/docs/plan.md" });
    expect(response.review.requestedAt).not.toBeNull();
    expect(recentDocuments.list()).toEqual(["docs/plan.md"]);
  });

  test("must send the doc to the latest tab when a tab is connected", async () => {
    const { agent, tabs } = await setUpAppTest(getDirectory());
    const shown: string[] = [];
    tabs.connect({ navigate: (url) => shown.push(url) });

    const response = await agent("POST", "/api/agent/open", { path: "docs/plan.md" });

    expect(await response.json()).toMatchObject({ navigated: true });
    expect(shown).toEqual(["http://127.0.0.1:4321/document/docs/plan.md"]);
  });

  test("must encode the doc's path in the URL when its name has spaces and non-ASCII characters", async () => {
    const { agent, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(root, "docs", "Design Notes café.md"), "# Notes\n");

    const response = await agent("POST", "/api/agent/open", { path: "docs/Design Notes café.md" });

    expect(await response.json()).toMatchObject({
      url: "http://127.0.0.1:4321/document/docs/Design%20Notes%20caf%C3%A9.md",
    });
  });

  test("must refuse to open a doc when it does not exist", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    const response = await agent("POST", "/api/agent/open", { path: "docs/missing.md" });

    expect(response.status).toBe(404);
  });

  test("must list the threads that need the agent when the CLI reads the inbox", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "request-changes" });

    const response = await agent("GET", "/api/inbox");

    expect(await response.json()).toMatchObject({ threads: [{ id: 1, status: "open" }] });
  });

  test("must return the thread and the remaining inbox when the agent resolves a thread", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });
    await browser("POST", "/api/submit", { verdict: "request-changes" });

    const response = agentThreadResponseSchema.parse(
      await (await agent("POST", "/api/agent/threads/1/resolve", { body: "Changed to 1h" })).json()
    );

    expect(response.thread.status).toBe("resolved");
    expect(response.inbox.threads.map((thread) => thread.id)).toEqual([2]);
  });

  test("must report a draft as unknown when the agent replies to it", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const response = await agent("POST", "/api/agent/threads/1/reply", { body: "Hello" });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { reason: "unknown-thread" } });
  });

  test("must shut the server down shortly after answering when the CLI asks it to stop", async () => {
    const { agent, shutdownCount } = await setUpAppTest(getDirectory());

    const response = await agent("POST", "/api/shutdown");

    expect(await response.json()).toEqual({ stopping: true });
    await vi.waitFor(() => expect(shutdownCount()).toBe(1));
  });
});
````

`src/server/http/pollRoutes.test.ts`:

````ts
import { describe, expect, test, vi } from "vitest";

import { pollResponseSchema } from "../../shared/api/apiResponseSchemas";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { cacheComment, setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("pollRoutes", () => {
  test("must return at once when a thread already needs the agent", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);
    await browser("POST", "/api/submit", { verdict: "request-changes" });

    const result = pollResponseSchema.parse(await (await agent("GET", "/api/poll?timeout=5")).json());

    expect(result).toMatchObject({ threads: [{ id: 1 }], timedOut: false });
  });

  test("must wait, report the agent waiting, and return the threads when the user submits", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const poll = agent("GET", "/api/poll?timeout=10");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "request-changes" });
    const result = pollResponseSchema.parse(await (await poll).json());

    expect(result).toMatchObject({ threads: [{ id: 1 }], timedOut: false });
    expect(activity.agentWaiting).toBe(false);
  });

  test("must hand the threads to every waiting poll when two agents poll at once", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", cacheComment);

    const polls = [agent("GET", "/api/poll?timeout=10"), agent("GET", "/api/poll?timeout=10")];
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "request-changes" });
    const results = await Promise.all(polls.map(async (poll) => pollResponseSchema.parse(await (await poll).json())));

    expect(results.map((result) => result.threads.map((thread) => thread.id))).toEqual([[1], [1]]);
  });

  test("must stop counting the agent as waiting when its poll disconnects", async () => {
    const { activity, agent } = await setUpAppTest(getDirectory());
    const response = await agent("GET", "/api/poll?timeout=10");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));

    await response.body?.cancel();

    await vi.waitFor(() => expect(activity.agentWaiting).toBe(false));
  });

  test("must return at once when the user has approved the round", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/submit", { verdict: "approve" });

    const result = pollResponseSchema.parse(await (await agent("GET", "/api/poll?timeout=5")).json());

    expect(result).toMatchObject({ review: { approved: true }, threads: [], timedOut: false });
  });

  test("must keep waiting and time out when the submit holds nothing for the polled doc", async () => {
    const { activity, agent, browser } = await setUpAppTest(getDirectory());
    await browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });

    const poll = agent("GET", "/api/poll?timeout=1&document=docs/plan.md");
    await vi.waitFor(() => expect(activity.agentWaiting).toBe(true));
    await browser("POST", "/api/submit", { verdict: "request-changes" });
    const result = pollResponseSchema.parse(await (await poll).json());

    expect(result).toMatchObject({ threads: [], timedOut: true });
  });

  test("must write spaces to keep the connection alive while it waits", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    const body = await (await agent("GET", "/api/poll?timeout=1")).text();

    expect(body.startsWith("  ")).toBe(true);
    expect(pollResponseSchema.parse(JSON.parse(body))).toMatchObject({ timedOut: true });
  });

  test("must refuse a timeout when it is not a whole number of seconds", async () => {
    const { agent } = await setUpAppTest(getDirectory());

    expect((await agent("GET", "/api/poll?timeout=soon")).status).toBe(400);
  });
});
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/server/http/agentRoutes.test.ts src/server/http/pollRoutes.test.ts`
Expected: FAIL. The routes answer 404, so responses fail schema parsing, and the poll tests that wait for `agentWaiting` time out in `vi.waitFor`.

- [ ] **Step 3: Write the poll wait and the routes**

`src/server/http/waitForInbox.ts`:

````ts
import type { PollResponse } from "../../shared/api/apiResponseSchemas";
import type { ServerEvents } from "../events/ServerEvents";
import type { ReviewStore } from "../store/ReviewStore";

export interface WaitForInboxOptions {
  document: string | null;
  events: ServerEvents;
  signal: AbortSignal;
  store: ReviewStore;
  timeoutMilliseconds: number;
}

type WaitOutcome = "submitted" | "timed-out" | "aborted";

/**
 * Waits until the review is approved or a thread needs the agent
 *
 * @returns the inbox as soon as it has something for the agent, or as it stands when the time runs out or the
 *   request is aborted, with `timedOut` set
 */
export async function waitForInbox({
  document,
  events,
  signal,
  store,
  timeoutMilliseconds,
}: WaitForInboxOptions): Promise<PollResponse> {
  const deadline = Date.now() + timeoutMilliseconds;
  for (;;) {
    const nextSubmit = waitForSubmit(events, deadline - Date.now(), signal);
    const inbox = await store.readInbox(document);
    if (inbox.review.approved || inbox.threads.length > 0) {
      nextSubmit.cancel();
      return { ...inbox, timedOut: false };
    }
    if ((await nextSubmit.outcome) !== "submitted") {
      return { ...inbox, timedOut: true };
    }
  }
}

/**
 * Starts listening for the next submit straight away, so one that happens while the inbox is being read is not missed
 */
function waitForSubmit(
  events: ServerEvents,
  timeoutMilliseconds: number,
  signal: AbortSignal
): { outcome: Promise<WaitOutcome>; cancel: () => void } {
  let finish: (outcome: WaitOutcome) => void = () => {};
  const outcome = new Promise<WaitOutcome>((resolve) => {
    finish = resolve;
  });
  const timer = setTimeout(() => finish("timed-out"), Math.max(0, timeoutMilliseconds));
  const onAbort = (): void => finish("aborted");
  signal.addEventListener("abort", onAbort);
  const unsubscribe = events.subscribe((event) => {
    if (event.type === "submitted") {
      finish("submitted");
    }
  });
  const cancel = (): void => {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
    unsubscribe();
  };
  if (signal.aborted) {
    finish("aborted");
  }
  void outcome.then(cancel);
  return { cancel, outcome };
}
````

`src/server/http/agentRoutes.ts`:

````ts
import type { Hono } from "hono";

import { agentOpenRequestSchema, messageRequestSchema, resolveRequestSchema } from "../../shared/api/apiRequestSchemas";
import type { AgentOpenResponse, AgentThreadResponse, ShutdownResponse } from "../../shared/api/apiResponseSchemas";
import type { Thread } from "../../shared/review/threadSchema";

import type { AppDependencies } from "./AppDependencies";
import { checkDocumentPath, readJsonBody, readThreadId } from "./requestInputs";

const shutdownDelayMilliseconds = 100;

export function registerAgentRoutes(app: Hono, dependencies: AppDependencies): void {
  const { events, port, recentDocuments, root, shutdown, store, tabs, watchDocument } = dependencies;
  const afterAgentAction = async (thread: Thread): Promise<AgentThreadResponse> => {
    events.publish({ type: "threads-changed" });
    return { inbox: await store.readInbox(null), thread };
  };

  app.post("/api/shutdown", (context) => {
    setTimeout(shutdown, shutdownDelayMilliseconds);
    const response: ShutdownResponse = { stopping: true };
    return context.json(response);
  });

  app.post("/api/agent/open", async (context) => {
    const { path } = await readJsonBody(context, agentOpenRequestSchema);
    if (path !== undefined) {
      await checkDocumentPath(root, path, false);
      recentDocuments.add(path);
      watchDocument(path);
    }
    const review = await store.requestReview();
    events.publish({ type: "threads-changed" });
    const pagePath = path === undefined ? "" : `document/${path.split("/").map(encodeURIComponent).join("/")}`;
    const url = `http://127.0.0.1:${port()}/${pagePath}`;
    const response: AgentOpenResponse = { navigated: tabs.navigateLatest(url), review, url };
    return context.json(response);
  });

  app.get("/api/inbox", async (context) => {
    const document = context.req.query("document");
    if (document !== undefined) {
      await checkDocumentPath(root, document, true);
    }
    return context.json(await store.readInbox(document ?? null));
  });

  app.post("/api/agent/threads/:id/reply", async (context) => {
    const { body } = await readJsonBody(context, messageRequestSchema);
    return context.json(await afterAgentAction(await store.replyAsAgent(readThreadId(context), body)));
  });

  app.post("/api/agent/threads/:id/resolve", async (context) => {
    const { body } = await readJsonBody(context, resolveRequestSchema);
    return context.json(await afterAgentAction(await store.resolveAsAgent(readThreadId(context), body)));
  });
}
````

`src/server/http/pollRoutes.ts`:

````ts
import type { Hono } from "hono";
import { stream } from "hono/streaming";

import type { AppDependencies } from "./AppDependencies";
import { HttpError } from "./HttpError";
import { checkDocumentPath } from "./requestInputs";
import { waitForInbox } from "./waitForInbox";

const defaultTimeoutSeconds = 540;

const maximumTimeoutSeconds = 24 * 60 * 60;

export function registerPollRoutes(app: Hono, dependencies: AppDependencies): void {
  const { activity, events, logger, pollKeepAliveMilliseconds, root, store } = dependencies;

  app.get("/api/poll", async (context) => {
    const document = context.req.query("document") ?? null;
    if (document !== null) {
      await checkDocumentPath(root, document, true);
    }
    const timeoutMilliseconds = readTimeoutSeconds(context.req.query("timeout")) * 1000;
    context.header("Content-Type", "application/json");
    return stream(context, async (output) => {
      const abort = new AbortController();
      output.onAbort(() => abort.abort());
      const endPoll = activity.beginPoll();
      const keepAlive = setInterval(() => {
        output.write(" ").catch(() => abort.abort());
      }, pollKeepAliveMilliseconds);
      try {
        const result = await waitForInbox({ document, events, signal: abort.signal, store, timeoutMilliseconds });
        if (!abort.signal.aborted) {
          await output.write(JSON.stringify(result));
        }
      } catch (error) {
        logger.error("A poll failed", error);
        await output.write(
          JSON.stringify({ error: { message: "The poll failed; see .markdown-review/server.log", reason: "internal" } })
        );
      } finally {
        clearInterval(keepAlive);
        endPoll();
      }
    });
  });
}

function readTimeoutSeconds(value: string | undefined): number {
  if (value === undefined) {
    return defaultTimeoutSeconds;
  }
  const seconds = Number(value);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > maximumTimeoutSeconds) {
    throw new HttpError(
      400,
      "invalid-input",
      `The timeout must be a whole number of seconds up to ${maximumTimeoutSeconds}`
    );
  }
  return seconds;
}
````

Replace `src/server/http/createApp.ts` with:

````ts
import { Hono } from "hono";

import type { StoreErrorReason } from "../store/StoreError";
import { StoreError } from "../store/StoreError";

import type { AppDependencies } from "./AppDependencies";
import { registerAgentRoutes } from "./agentRoutes";
import { registerBrowserRoutes } from "./browserRoutes";
import { registerFileRoutes } from "./fileRoutes";
import { registerHealthRoutes } from "./healthRoutes";
import { HttpError } from "./HttpError";
import { registerPollRoutes } from "./pollRoutes";
import { requireAgentToken, requireBrowserOrigin, requireLocalHost } from "./securityMiddleware";
import { registerShellRoutes } from "./shellRoutes";

const statusForStoreError = {
  "invalid-file": 500,
  "invalid-input": 400,
  "invalid-state": 409,
  "missing-document": 404,
  "unknown-thread": 404,
} as const satisfies Record<StoreErrorReason, number>;

/**
 * Builds the server's HTTP app: the agent's API, the browser's API, the event stream, repo files and the app shell
 *
 * @param dependencies the store and the server's shared state
 * @returns the app, ready to be served on 127.0.0.1
 */
export function createApp(dependencies: AppDependencies): Hono {
  const { activity, logger, port, token } = dependencies;
  const app = new Hono();
  app.use("*", requireLocalHost(port));
  app.use("*", async (_context, next) => {
    activity.touch();
    await next();
  });
  for (const agentPath of ["/api/agent/*", "/api/inbox", "/api/poll", "/api/shutdown"]) {
    app.use(agentPath, requireAgentToken(token));
  }
  for (const browserPath of ["/api/threads", "/api/threads/*", "/api/submit"]) {
    app.use(browserPath, requireBrowserOrigin(port));
  }
  app.onError((error, context) => {
    if (error instanceof HttpError) {
      return context.json({ error: { message: error.message, reason: error.reason } }, error.status);
    }
    if (error instanceof StoreError) {
      return context.json(
        { error: { message: error.message, reason: error.reason } },
        statusForStoreError[error.reason]
      );
    }
    logger.error(`${context.req.method} ${context.req.path} failed`, error);
    return context.json(
      {
        error: {
          message: "The server failed to handle the request; see .markdown-review/server.log",
          reason: "internal",
        },
      },
      500
    );
  });
  registerHealthRoutes(app, dependencies);
  registerAgentRoutes(app, dependencies);
  registerPollRoutes(app, dependencies);
  registerBrowserRoutes(app, dependencies);
  registerFileRoutes(app, dependencies);
  registerShellRoutes(app);
  return app;
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/server/http`, then `pnpm verify`
Expected: 8 `agentRoutes` and 8 `pollRoutes` tests pass, including the three Review Focus cases; `pnpm verify` is clean with 283 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the agent's routes and the waiting poll"
```

---

### Task 7: The event stream for browser tabs

**Files:**
- Create: `src/server/http/eventRoutes.ts`, `src/server/http/testing/readServerSentEvents.ts`
- Modify: `src/server/http/createApp.ts` (register the event route; final version)
- Test: `src/server/http/eventRoutes.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4 and 6.
- Produces:
  - `GET /api/events`: an SSE stream that sends `presence` first, then every `threads-changed`, `document-changed` and `presence`, plus `navigate` (`{ url }`) to the most recently connected tab. A connected tab counts as activity.
  - Test helper `readServerSentEvents(response): EventReader` (`next(count)`, `close()`), which Task 8 reuses.

- [ ] **Step 1: Write the test helper and the failing test**

`src/server/http/testing/readServerSentEvents.ts`:

````ts
export interface ReceivedEvent {
  data: unknown;
  event: string;
}

export interface EventReader {
  next(count: number): Promise<ReceivedEvent[]>;
  close(): Promise<void>;
}

/**
 * Reads server-sent events from a response, the way a browser's EventSource would
 *
 * @param response the response of `GET /api/events`
 * @returns a reader whose `next` resolves with the next `count` events
 */
export function readServerSentEvents(response: Response): EventReader {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new TypeError("The event stream has no body");
  }
  const decoder = new TextDecoder();
  let buffered = "";
  const next = async (count: number): Promise<ReceivedEvent[]> => {
    const received: ReceivedEvent[] = [];
    while (received.length < count) {
      const separator = buffered.indexOf("\n\n");
      if (separator === -1) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffered += decoder.decode(value, { stream: true });
        continue;
      }
      const block = buffered.slice(0, separator);
      buffered = buffered.slice(separator + 2);
      const fields = new Map(
        block.split("\n").map((line) => [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2)])
      );
      received.push({ data: JSON.parse(fields.get("data") ?? "null"), event: fields.get("event") ?? "" });
    }
    return received;
  };
  return { close: () => reader.cancel(), next };
}
````

`src/server/http/eventRoutes.test.ts`:

````ts
import { describe, expect, test, vi } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { readServerSentEvents } from "./testing/readServerSentEvents";
import { setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("eventRoutes", () => {
  test("must send the agent's presence first, then changes and navigation to the connected tab", async () => {
    const { agent, browser } = await setUpAppTest(getDirectory());
    const events = readServerSentEvents(await browser("GET", "/api/events"));

    await agent("POST", "/api/agent/open", { path: "docs/plan.md" });

    expect(await events.next(3)).toEqual([
      { data: { agentWaiting: false }, event: "presence" },
      { data: {}, event: "threads-changed" },
      { data: { url: "http://127.0.0.1:4321/document/docs/plan.md" }, event: "navigate" },
    ]);
    await events.close();
  });

  test("must stop sending to the tab and count it as gone when the tab disconnects", async () => {
    const { activity, browser, tabs } = await setUpAppTest(getDirectory());
    const events = readServerSentEvents(await browser("GET", "/api/events"));
    await events.next(1);

    await events.close();

    await vi.waitFor(() => expect(tabs.navigateLatest("/")).toBe(false));
    expect(activity.agentWaiting).toBe(false);
  });
});
````

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test src/server/http/eventRoutes.test.ts`
Expected: FAIL. `/api/events` answers 404, so no events arrive and the first test's `toEqual` gets `[]`; the second times out in `vi.waitFor`.

- [ ] **Step 3: Write the event route and register it**

`src/server/http/eventRoutes.ts`:

````ts
import type { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import type { AppDependencies } from "./AppDependencies";

export function registerEventRoutes(app: Hono, { activity, events, logger, tabs }: AppDependencies): void {
  app.get("/api/events", (context) =>
    streamSSE(context, async (output) => {
      let writes = Promise.resolve();
      const send = (event: string, data: unknown): void => {
        writes = writes
          .then(() => output.writeSSE({ data: JSON.stringify(data), event }))
          .catch((error: unknown) => logger.warn("Could not write to a browser's event stream", error));
      };
      const endBrowser = activity.beginBrowser();
      const unsubscribe = events.subscribe((event) => {
        if (event.type !== "submitted") {
          const { type, ...data } = event;
          send(type, data);
        }
      });
      const disconnect = tabs.connect({ navigate: (url) => send("navigate", { url }) });
      send("presence", { agentWaiting: activity.agentWaiting });
      await new Promise<void>((resolve) => output.onAbort(resolve));
      unsubscribe();
      disconnect();
      endBrowser();
    })
  );
}
````

Replace `src/server/http/createApp.ts` with:

````ts
import { Hono } from "hono";

import type { StoreErrorReason } from "../store/StoreError";
import { StoreError } from "../store/StoreError";

import type { AppDependencies } from "./AppDependencies";
import { registerAgentRoutes } from "./agentRoutes";
import { registerBrowserRoutes } from "./browserRoutes";
import { registerEventRoutes } from "./eventRoutes";
import { registerFileRoutes } from "./fileRoutes";
import { registerHealthRoutes } from "./healthRoutes";
import { HttpError } from "./HttpError";
import { registerPollRoutes } from "./pollRoutes";
import { requireAgentToken, requireBrowserOrigin, requireLocalHost } from "./securityMiddleware";
import { registerShellRoutes } from "./shellRoutes";

const statusForStoreError = {
  "invalid-file": 500,
  "invalid-input": 400,
  "invalid-state": 409,
  "missing-document": 404,
  "unknown-thread": 404,
} as const satisfies Record<StoreErrorReason, number>;

/**
 * Builds the server's HTTP app: the agent's API, the browser's API, the event stream, repo files and the app shell
 *
 * @param dependencies the store and the server's shared state
 * @returns the app, ready to be served on 127.0.0.1
 */
export function createApp(dependencies: AppDependencies): Hono {
  const { activity, logger, port, token } = dependencies;
  const app = new Hono();
  app.use("*", requireLocalHost(port));
  app.use("*", async (_context, next) => {
    activity.touch();
    await next();
  });
  for (const agentPath of ["/api/agent/*", "/api/inbox", "/api/poll", "/api/shutdown"]) {
    app.use(agentPath, requireAgentToken(token));
  }
  for (const browserPath of ["/api/threads", "/api/threads/*", "/api/submit"]) {
    app.use(browserPath, requireBrowserOrigin(port));
  }
  app.onError((error, context) => {
    if (error instanceof HttpError) {
      return context.json({ error: { message: error.message, reason: error.reason } }, error.status);
    }
    if (error instanceof StoreError) {
      return context.json(
        { error: { message: error.message, reason: error.reason } },
        statusForStoreError[error.reason]
      );
    }
    logger.error(`${context.req.method} ${context.req.path} failed`, error);
    return context.json(
      {
        error: {
          message: "The server failed to handle the request; see .markdown-review/server.log",
          reason: "internal",
        },
      },
      500
    );
  });
  registerHealthRoutes(app, dependencies);
  registerAgentRoutes(app, dependencies);
  registerPollRoutes(app, dependencies);
  registerBrowserRoutes(app, dependencies);
  registerEventRoutes(app, dependencies);
  registerFileRoutes(app, dependencies);
  registerShellRoutes(app);
  return app;
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/server/http`, then `pnpm verify`
Expected: 2 `eventRoutes` tests pass; `pnpm verify` is clean with 285 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Stream review events to browser tabs"
```

---

### Task 8: Run the server process

**Files:**
- Create: `src/server/runtime/DocumentWatcher.ts`, `serverFileSchema.ts`, `packageVersion.ts`, `runServer.ts` (in `src/server/runtime/`)
- Modify: `src/server/store/storePaths.ts` (add `serverFilePath`), `tsconfig.server.json` (`resolveJsonModule`)
- Test: `src/server/runtime/DocumentWatcher.test.ts`, `src/server/runtime/runServer.test.ts`

**Interfaces:**
- Consumes: Tasks 2 to 7 and plan 1's store.
- Produces:
  - `class DocumentWatcher` with `constructor(root, onChange: (document: string) => void)`, `watch(document): void`, `close(): Promise<void>`.
  - `serverFileSchema` and `type ServerFile`.
  - `packageVersion: string` (from `package.json`).
  - `serverFilePath(root): string`.
  - `runServer({ root, logger, idleMilliseconds?, pollKeepAliveMilliseconds? }): Promise<RunningServer>`, where `interface RunningServer { port: number; closed: Promise<void>; close(): Promise<void> }`. It initializes the store first, listens on 127.0.0.1 (preferred port, else any), writes `server.json` (mode 0600), watches every doc with threads, re-anchors and announces edited docs, stops when idle, and removes `server.json` when it stops.

- [ ] **Step 1: Add the server dependencies and JSON imports**

```bash
pnpm add @hono/node-server chokidar
pnpm format
```

Replace `tsconfig.server.json` with:

````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.server.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true
  },
  "include": ["src/cli", "src/server", "src/shared"]
}
````

- [ ] **Step 2: Write the failing tests**

`src/server/runtime/DocumentWatcher.test.ts`:

````ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { DocumentWatcher } from "./DocumentWatcher";

const getDirectory = setUpTemporaryDirectory();

describe("DocumentWatcher", () => {
  test("must report the doc's repo-relative path when a watched doc is saved", async () => {
    const root = getDirectory();
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
    const changed: string[] = [];
    const watcher = new DocumentWatcher(root, (document) => changed.push(document));
    watcher.watch("docs/plan.md");
    await new Promise((resolve) => setTimeout(resolve, 200));

    await writeFile(path.join(root, "docs", "plan.md"), "# Plan, edited\n");

    await vi.waitFor(() => expect(changed).toContain("docs/plan.md"), { timeout: 5000 });
    await watcher.close();
  });
});
````

`src/server/runtime/runServer.test.ts`:

````ts
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { healthSchema } from "../../shared/api/apiResponseSchemas";
import { readServerSentEvents } from "../http/testing/readServerSentEvents";
import { createMemoryLogger } from "../logging/testing/createMemoryLogger";
import { serverFilePath } from "../store/storePaths";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { preferredPort } from "./preferredPort";
import type { RunningServer } from "./runServer";
import { runServer } from "./runServer";
import { serverFileSchema } from "./serverFileSchema";

const getDirectory = setUpTemporaryDirectory();

const cleanUps: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanUp of cleanUps.splice(0)) {
    await cleanUp();
  }
});

describe("runServer", () => {
  test("must record itself in a private server.json and answer on that port when it starts", async () => {
    const { root, server } = await setUpTest();

    const recorded = serverFileSchema.parse(JSON.parse(await readFile(serverFilePath(root), "utf8")));
    const health = healthSchema.parse(await (await fetch(`http://127.0.0.1:${recorded.port}/api/health`)).json());

    expect(recorded).toMatchObject({ pid: process.pid, port: server.port, protocol: 1, root });
    expect((await stat(serverFilePath(root))).mode & 0o777).toBe(0o600);
    expect(health.root).toBe(root);
  });

  test("must remove server.json when it stops", async () => {
    const { root, server } = await setUpTest();

    await server.close();

    await expect(stat(serverFilePath(root))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("must listen on another port when its preferred port is taken", async () => {
    const root = await createRepository();
    const blocker = createServer();
    await new Promise<void>((resolve) => blocker.listen(preferredPort(root), "127.0.0.1", resolve));
    cleanUps.push(() => new Promise((resolve) => blocker.close(() => resolve())));

    const { server } = await setUpTest({ root });

    expect(server.port).not.toBe(preferredPort(root));
  });

  test("must stop itself when nothing has used it for the idle period", async () => {
    const { server } = await setUpTest({ idleMilliseconds: 50 });

    await expect(server.closed).resolves.toBeUndefined();
  });

  test("must tell connected tabs when a doc with comments is edited", async () => {
    const { root, server } = await setUpTest();
    const origin = `http://127.0.0.1:${server.port}`;
    await fetch(`${origin}/api/threads`, {
      body: JSON.stringify({ anchor: { document: "docs/plan.md", kind: "document" }, body: "Doc?" }),
      headers: { "content-type": "application/json", origin },
      method: "POST",
    });
    const events = readServerSentEvents(await fetch(`${origin}/api/events`));
    await events.next(1);

    await writeFile(path.join(root, "docs", "plan.md"), "# Plan, edited\n");

    expect(await events.next(2)).toEqual([
      { data: { document: "docs/plan.md" }, event: "document-changed" },
      { data: {}, event: "threads-changed" },
    ]);
    await events.close();
  });
});

async function setUpTest({ idleMilliseconds, root }: { idleMilliseconds?: number; root?: string } = {}): Promise<{
  root: string;
  server: RunningServer;
}> {
  const repositoryRoot = root ?? (await createRepository());
  const server = await runServer({ idleMilliseconds, logger: createMemoryLogger().logger, root: repositoryRoot });
  cleanUps.unshift(() => server.close());
  return { root: repositoryRoot, server };
}

async function createRepository(): Promise<string> {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  return root;
}
````

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test src/server/runtime`
Expected: FAIL with `Cannot find module './DocumentWatcher'` and `Cannot find module './runServer'`.

- [ ] **Step 4: Write the server file path and the runtime**

Replace `src/server/store/storePaths.ts` with:

````ts
import path from "node:path";

const storeDirectoryName = ".markdown-review";

export function storeDirectory(root: string): string {
  return path.join(root, storeDirectoryName);
}

export function reviewFilePath(root: string): string {
  return path.join(storeDirectory(root), "review.json");
}

export function serverFilePath(root: string): string {
  return path.join(storeDirectory(root), "server.json");
}

export function documentsDirectory(root: string): string {
  return path.join(storeDirectory(root), "documents");
}

/**
 * Locates the file holding a doc's threads
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path, e.g. "docs/plan.md"
 * @returns where the doc's threads are stored, e.g. "<root>/.markdown-review/documents/docs/plan.md.json"
 */
export function documentThreadsFilePath(root: string, document: string): string {
  return path.join(documentsDirectory(root), ...`${document}.json`.split("/"));
}

/**
 * Locates a doc's source on disk
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path
 * @returns the doc's path on disk
 */
export function documentSourcePath(root: string, document: string): string {
  return path.join(root, ...document.split("/"));
}
````

`src/server/runtime/serverFileSchema.ts`:

````ts
import { z } from "zod";

/**
 * `.markdown-review/server.json`: how the CLI finds and authenticates to the root's running server
 */
export const serverFileSchema = z.strictObject({
  pid: z.int(),
  port: z.int().min(1).max(65535),
  protocol: z.int(),
  root: z.string(),
  startedAt: z.iso.datetime(),
  token: z.string().regex(/^[0-9a-f]{64}$/),
  version: z.string(),
});

export type ServerFile = z.infer<typeof serverFileSchema>;
````

`src/server/runtime/packageVersion.ts`:

````ts
import packageJson from "../../../package.json" with { type: "json" };

export const packageVersion: string = packageJson.version;
````

`src/server/runtime/DocumentWatcher.ts`:

````ts
import path from "node:path";

import type { FSWatcher } from "chokidar";
import { watch } from "chokidar";

/**
 * Watches docs for edits, so connected tabs can be told as soon as the agent saves one
 */
export class DocumentWatcher {
  private readonly documents = new Map<string, string>();
  private readonly root: string;
  private readonly watcher: FSWatcher;

  /**
   * @param root the repo root
   * @param onChange called with a doc's repo-relative path when it is written, created or deleted
   */
  public constructor(root: string, onChange: (document: string) => void) {
    this.root = root;
    this.watcher = watch([], {
      atomic: true,
      awaitWriteFinish: { pollInterval: 20, stabilityThreshold: 50 },
      ignoreInitial: true,
    });
    this.watcher.on("all", (_event, changedPath) => {
      const document = this.documents.get(changedPath);
      if (document !== undefined) {
        onChange(document);
      }
    });
  }

  /**
   * @param document a repo-relative POSIX path; watching a doc twice has no further effect
   */
  public watch(document: string): void {
    const absolutePath = path.join(this.root, ...document.split("/"));
    if (!this.documents.has(absolutePath)) {
      this.documents.set(absolutePath, document);
      this.watcher.add(absolutePath);
    }
  }

  public close(): Promise<void> {
    return this.watcher.close();
  }
}
````

`src/server/runtime/runServer.ts`:

````ts
import { randomBytes } from "node:crypto";
import type { Server } from "node:http";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";

import { getRequestListener } from "@hono/node-server";

import { protocolVersion } from "../../shared/api/protocolVersion";
import { BrowserTabs } from "../events/BrowserTabs";
import { ServerEvents } from "../events/ServerEvents";
import { readTextFileOrNull } from "../files/readTextFileOrNull";
import { writeJsonAtomically } from "../files/writeJsonAtomically";
import { createApp } from "../http/createApp";
import { RecentDocuments } from "../http/RecentDocuments";
import type { Logger } from "../logging/Logger";
import { ReviewStore } from "../store/ReviewStore";
import { serverFilePath } from "../store/storePaths";

import { ActivityMonitor } from "./ActivityMonitor";
import { DocumentWatcher } from "./DocumentWatcher";
import { packageVersion } from "./packageVersion";
import { preferredPort } from "./preferredPort";
import type { ServerFile } from "./serverFileSchema";
import { serverFileSchema } from "./serverFileSchema";

export interface RunServerOptions {
  root: string;
  logger: Logger;

  /**
   * How long the server stays up with no connected tab, no waiting poll and no request
   */
  idleMilliseconds?: number;

  pollKeepAliveMilliseconds?: number;
}

export interface RunningServer {
  port: number;

  /**
   * Resolves once the server has stopped, whether through `close`, the idle timeout or a shutdown request
   */
  closed: Promise<void>;

  close(): Promise<void>;
}

/**
 * Starts the root's review server on 127.0.0.1 and records it in `.markdown-review/server.json`
 *
 * @returns the running server; it removes `server.json` when it stops
 */
export async function runServer({
  idleMilliseconds = 30 * 60_000,
  logger,
  pollKeepAliveMilliseconds = 15_000,
  root,
}: RunServerOptions): Promise<RunningServer> {
  const store = new ReviewStore(root, logger);
  await store.initialize();
  const events = new ServerEvents();
  let port = 0;
  let stopping: Promise<void> | undefined;
  let markClosed = (): void => {};
  const closed = new Promise<void>((resolve) => {
    markClosed = resolve;
  });
  const close = (): Promise<void> => {
    stopping ??= stop();
    return stopping;
  };
  const closeInBackground = (): void => {
    close().catch((error: unknown) => logger.error("The server did not stop cleanly", error));
  };
  const activity = new ActivityMonitor({ events, idleMilliseconds, onIdle: closeInBackground });
  const watcher = new DocumentWatcher(root, (document) => {
    store
      .readThreads(document)
      .then(() => {
        events.publish({ document, type: "document-changed" });
        events.publish({ type: "threads-changed" });
      })
      .catch((error: unknown) => logger.warn(`Could not re-anchor ${document} after it changed`, error));
  });
  const token = randomBytes(32).toString("hex");
  const app = createApp({
    activity,
    events,
    logger,
    pollKeepAliveMilliseconds,
    port: () => port,
    recentDocuments: new RecentDocuments(),
    root,
    shutdown: closeInBackground,
    store,
    tabs: new BrowserTabs(),
    token,
    version: packageVersion,
    watchDocument: (document) => watcher.watch(document),
  });
  const server = createServer(getRequestListener(app.fetch));
  port = await listen(server, preferredPort(root));
  const serverFile: ServerFile = {
    pid: process.pid,
    port,
    protocol: protocolVersion,
    root,
    startedAt: new Date().toISOString(),
    token,
    version: packageVersion,
  };
  await writeJsonAtomically(serverFilePath(root), serverFile, 0o600);
  for (const thread of (await store.readThreads(null)).threads) {
    if (thread.anchor.kind !== "review") {
      watcher.watch(thread.anchor.document);
    }
  }
  logger.info(`Serving ${root} on http://127.0.0.1:${port}`);

  async function stop(): Promise<void> {
    activity.stop();
    await watcher.close();
    await closeServer(server);
    await removeServerFile(root);
    logger.info("Stopped");
    markClosed();
  }

  return { close, closed, port };
}

async function listen(server: Server, port: number): Promise<number> {
  try {
    return await listenOn(server, port);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EADDRINUSE") {
      return listenOn(server, 0);
    }
    throw error;
  }
}

function listenOn(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off("listening", onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off("error", onError);
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new TypeError("The server is not listening on a TCP port"));
        return;
      }
      resolve(address.port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
    server.closeAllConnections();
  });
}

/**
 * Removes `server.json` unless a newer server has already replaced it
 */
async function removeServerFile(root: string): Promise<void> {
  const contents = await readTextFileOrNull(serverFilePath(root));
  if (contents === null) {
    return;
  }
  let recorded: unknown;
  try {
    recorded = JSON.parse(contents);
  } catch {
    return;
  }
  if (serverFileSchema.safeParse(recorded).data?.pid === process.pid) {
    await rm(serverFilePath(root), { force: true });
  }
}
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/server/runtime`, then `pnpm verify`
Expected: all `runtime` tests pass, including "must tell connected tabs when a doc with comments is edited"; `pnpm verify` is clean with 291 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Run the review server process"
```

---

### Task 9: The CLI's output

**Files:**
- Create: `src/cli/formatIdList.ts`, `src/cli/nextSteps.ts`, `src/cli/formatInbox.ts`, `src/cli/formatAgentAction.ts`
- Test: `src/cli/formatIdList.test.ts`, `src/cli/formatInbox.test.ts`, `src/cli/formatAgentAction.test.ts`

**Interfaces:**
- Consumes: Task 1's `ThreadsSnapshot` and `AgentThreadResponse`; plan 1's test builders.
- Produces:
  - `formatIdList(ids): string` ("#14", "#14 and #15", "#14, #15 and #16").
  - `nextSteps.ts`: `waitForCommentsStep`, `approvedStep`, `addressThreadsStep(ids)`, `approvedWithCommentsStep(ids)`, and an unexported `pollTimeoutAdvice`, which Task 11 exports.
  - `formatInbox(snapshot): string`, following the spec's three examples exactly.
  - `formatAgentAction(action: "replied" | "resolved", response: AgentThreadResponse): string`.

- [ ] **Step 1: Write the failing tests**

`src/cli/formatIdList.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { formatIdList } from "./formatIdList";

describe("formatIdList", () => {
  test.each([
    { ids: [14], expected: "#14" },
    { ids: [14, 15], expected: "#14 and #15" },
    { ids: [14, 15, 16], expected: "#14, #15 and #16" },
  ])("must return '$expected' when the IDs are $ids", ({ ids, expected }) => {
    expect(formatIdList(ids)).toBe(expected);
  });
});
````

`src/cli/formatInbox.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import type { ThreadsSnapshot } from "../shared/api/apiResponseSchemas";
import { buildPassageAnchor, buildThread, testTime } from "../shared/review/testing/reviewBuilders";
import type { Thread } from "../shared/review/threadSchema";

import { formatInbox } from "./formatInbox";

const notApproved = { approved: false, approvedAt: null, requestedAt: testTime };

const approved = { approved: true, approvedAt: "2026-10-08T10:00:00.000Z", requestedAt: testTime };

const cacheThread = buildThread({
  anchor: buildPassageAnchor({
    anchoredText: "cache results for 24h",
    document: "docs/plans/plan.md",
    endLine: 13,
    quote: "cache results for 24h",
    startLine: 12,
  }),
  id: 14,
  messages: [{ at: testTime, author: "user", body: "Why 24h? Upstream data changes hourly." }],
});

const retryThread = buildThread({
  id: 15,
  messages: [{ at: testTime, author: "user", body: "The spec and plan disagree on the retry policy." }],
});

describe("formatInbox", () => {
  test("must group threads by doc and name every ID in next_step when threads need the agent", () => {
    const text = formatInbox(snapshot([retryThread, cacheThread]));

    expect(text).toBe(
      [
        "2 threads need you (docs/plans/plan.md: 1, review: 1)",
        "",
        "#14 docs/plans/plan.md:12-13",
        '  quote: "cache results for 24h"',
        "  user: Why 24h? Upstream data changes hourly.",
        "",
        "#15 (whole review)",
        "  user: The spec and plan disagree on the retry policy.",
        "",
        'next_step: Edit the docs, then run `markdown-review resolve <id> "<what changed>"` for #14 and #15, or ' +
          '`markdown-review reply <id> "<question>"` if you need input. Then run `markdown-review poll` to wait for ' +
          "the next round.",
        "",
      ].join("\n")
    );
  });

  test("must tell the agent to carry on when the review is approved and nothing needs it", () => {
    expect(formatInbox(snapshot([], approved))).toBe(
      "Review approved. No threads need you.\n\nnext_step: The user approved the review. Carry on with your task; " +
        "do not run `markdown-review poll` again for this review.\n"
    );
  });

  test("must ask for the comment to be resolved before carrying on when the review is approved with a comment", () => {
    const thread = buildThread({
      anchor: buildPassageAnchor({
        anchoredText: "retry three times",
        document: "docs/plans/plan.md",
        endLine: 40,
        quote: "retry three times",
        startLine: 40,
      }),
      id: 16,
      messages: [{ at: testTime, author: "user", body: "Nit: make the retry count configurable." }],
    });

    expect(formatInbox(snapshot([thread], approved))).toBe(
      [
        "Review approved, 1 thread needs you (docs/plans/plan.md: 1)",
        "",
        "#16 docs/plans/plan.md:40",
        '  quote: "retry three times"',
        "  user: Nit: make the retry count configurable.",
        "",
        "next_step: The user approved the review with comments. Address #16 and run " +
          '`markdown-review resolve 16 "<what changed>"`, then carry on with your task; do not run ' +
          "`markdown-review poll` again for this review.",
        "",
      ].join("\n")
    );
  });

  test("must tell the agent to wait for comments when nothing needs it and the review is not approved", () => {
    expect(formatInbox(snapshot([]))).toBe(
      "No threads need you.\n\nnext_step: Run `markdown-review poll` to wait for the user's comments. Give the shell " +
        "command a timeout of at least 600000 ms, or in Claude Code run it with run_in_background and `--timeout 7080`.\n"
    );
  });

  test.each<{ condition: string; thread: Thread; expected: string[] }>([
    {
      condition: "a reopened thread has several messages, one of them on two lines",
      thread: buildThread({
        id: 3,
        messages: [
          { at: testTime, author: "user", body: "Why?" },
          { at: testTime, author: "agent", body: "Because of\nthe upstream limit." },
          { at: testTime, author: "user", body: "Not convinced." },
        ],
      }),
      expected: [
        "#3 (whole review)",
        "  user: Why?",
        "  agent: Because of",
        "    the upstream limit.",
        "  user: Not convinced.",
      ],
    },
    {
      condition: "the agent's edit changed the quoted text",
      thread: buildThread({ anchor: buildPassageAnchor({ anchoredText: "cache results for 1h" }), id: 4 }),
      expected: [
        "#4 docs/plan.md:3",
        '  quote: "cache results for 1h"',
        '  was: "cache results for 24h"',
        "  user: Why 24h?",
      ],
    },
    {
      condition: "the passage is outdated",
      thread: buildThread({
        anchor: buildPassageAnchor({ anchoredText: "cache results for 1h", outdated: true }),
        id: 5,
      }),
      expected: ["#5 docs/plan.md:3 (outdated)", '  quote: "cache results for 24h"', "  user: Why 24h?"],
    },
    {
      condition: "the comment is on a whole doc",
      thread: buildThread({ anchor: { document: "docs/x.md", kind: "document" }, id: 6 }),
      expected: ["#6 docs/x.md (whole doc)", "  user: Why 24h?"],
    },
    {
      condition: "the quote is longer than 200 characters",
      thread: buildThread({
        anchor: buildPassageAnchor({
          anchoredText: `${"a".repeat(150)}${"b".repeat(100)}`,
          quote: `${"a".repeat(150)}${"b".repeat(100)}`,
        }),
        id: 7,
      }),
      expected: ["#7 docs/plan.md:3", `  quote: "${"a".repeat(120)}…${"b".repeat(60)}"`, "  user: Why 24h?"],
    },
  ])("must describe the thread compactly when $condition", ({ thread, expected }) => {
    const lines = formatInbox(snapshot([thread])).split("\n");

    expect(lines.slice(2, 2 + expected.length)).toEqual(expected);
  });

  test("must list each unreadable store file as a warning before next_step", () => {
    const text = formatInbox({ ...snapshot([]), problems: ["/repo/.markdown-review/review.json is not valid JSON"] });

    expect(text).toContain("\n\nwarning: /repo/.markdown-review/review.json is not valid JSON\n\nnext_step: ");
  });
});

function snapshot(threads: Thread[], review: ThreadsSnapshot["review"] = notApproved): ThreadsSnapshot {
  return { problems: [], review, threads };
}
````

`src/cli/formatAgentAction.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { buildThread, testTime } from "../shared/review/testing/reviewBuilders";

import { formatAgentAction } from "./formatAgentAction";

const notApproved = { approved: false, approvedAt: null, requestedAt: testTime };

describe("formatAgentAction", () => {
  test("must confirm the reply and list the threads still waiting when others need the agent", () => {
    const text = formatAgentAction("replied", {
      inbox: { problems: [], review: notApproved, threads: [buildThread({ id: 15 }), buildThread({ id: 16 })] },
      thread: buildThread({ id: 14 }),
    });

    expect(text).toBe(
      "Replied to #14; it waits for the user.\n2 threads still need you: #15 and #16.\n\nnext_step: Address #15 and #16, " +
        'then run `markdown-review resolve <id> "<what changed>"`, or `markdown-review reply <id> "<question>"` if you need input.\n'
    );
  });

  test("must tell the agent to wait for the next round when it resolved the last thread", () => {
    const text = formatAgentAction("resolved", {
      inbox: { problems: [], review: notApproved, threads: [] },
      thread: buildThread({ id: 14, status: "resolved" }),
    });

    expect(text).toBe(
      "Resolved #14. No threads need you now.\n\nnext_step: Run `markdown-review poll` to wait for the user's next round of comments.\n"
    );
  });

  test("must tell the agent to carry on when it resolved the last thread of an approved review", () => {
    const text = formatAgentAction("resolved", {
      inbox: { problems: [], review: { ...notApproved, approved: true, approvedAt: testTime }, threads: [] },
      thread: buildThread({ id: 14, status: "resolved" }),
    });

    expect(text).toContain("next_step: The user approved the review. Carry on with your task;");
  });
});
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/cli`
Expected: FAIL with `Cannot find module './formatIdList'`, `'./formatInbox'` and `'./formatAgentAction'`.

- [ ] **Step 3: Write the formatting**

`src/cli/formatIdList.ts`:

````ts
/**
 * Lists thread IDs the way the CLI's sentences name them
 *
 * @param ids the thread IDs, in the order to list them
 * @returns e.g. "#14", "#14 and #15", or "#14, #15 and #16"
 */
export function formatIdList(ids: readonly number[]): string {
  const names = ids.map((id) => `#${id}`);
  const last = names.pop();
  if (last === undefined) {
    return "";
  }
  return names.length === 0 ? last : `${names.join(", ")} and ${last}`;
}
````

`src/cli/nextSteps.ts`:

````ts
import { formatIdList } from "./formatIdList";

const pollTimeoutAdvice =
  "Give the shell command a timeout of at least 600000 ms, or in Claude Code run it with run_in_background and `--timeout 7080`.";

export const waitForCommentsStep = `Run \`markdown-review poll\` to wait for the user's comments. ${pollTimeoutAdvice}`;

export const approvedStep =
  "The user approved the review. Carry on with your task; do not run `markdown-review poll` again for this review.";

/**
 * @param ids the threads that need the agent, at least one
 */
export function addressThreadsStep(ids: readonly number[]): string {
  return (
    `Edit the docs, then run \`markdown-review resolve <id> "<what changed>"\` for ${formatIdList(ids)}, ` +
    'or `markdown-review reply <id> "<question>"` if you need input. ' +
    "Then run `markdown-review poll` to wait for the next round."
  );
}

/**
 * @param ids the threads the user commented on when approving, at least one
 */
export function approvedWithCommentsStep(ids: readonly number[]): string {
  const resolveCommand =
    ids.length === 1
      ? `\`markdown-review resolve ${ids[0]} "<what changed>"\``
      : '`markdown-review resolve <id> "<what changed>"` for each';
  return (
    `The user approved the review with comments. Address ${formatIdList(ids)} and run ${resolveCommand}, ` +
    "then carry on with your task; do not run `markdown-review poll` again for this review."
  );
}
````

`src/cli/formatInbox.ts`:

````ts
import type { ThreadsSnapshot } from "../shared/api/apiResponseSchemas";
import type { Thread } from "../shared/review/threadSchema";

import { addressThreadsStep, approvedStep, approvedWithCommentsStep, waitForCommentsStep } from "./nextSteps";

const longQuoteLength = 200;

const quoteStartLength = 120;

const quoteEndLength = 60;

/**
 * Describes the agent's inbox as compact text for the agent to read
 *
 * @param snapshot the review state and the threads that need the agent
 * @returns the summary, each thread grouped by doc with its messages, any store problems, and a final `next_step`
 */
export function formatInbox({ problems, review, threads }: ThreadsSnapshot): string {
  const ordered = orderByDocument(threads);
  const ids = ordered.map((thread) => thread.id);
  const sections = [summaryLine(review.approved, ordered)];
  if (ordered.length > 0) {
    sections.push(ordered.map(formatThread).join("\n\n"));
  }
  if (problems.length > 0) {
    sections.push(problems.map((problem) => `warning: ${indentContinuation(problem, "  ")}`).join("\n"));
  }
  sections.push(`next_step: ${nextStep(review.approved, ids)}`);
  return `${sections.join("\n\n")}\n`;
}

function formatThread(thread: Thread): string {
  const messages = thread.messages.map(({ author, body }) => `  ${author}: ${indentContinuation(body, "    ")}`);
  return [...describeAnchor(thread), ...messages].join("\n");
}

/**
 * Says where the thread is, and for a passage, the text it quotes now and what the user originally selected
 */
function describeAnchor({ anchor, id }: Thread): string[] {
  switch (anchor.kind) {
    case "review":
      return [`#${id} (whole review)`];
    case "document":
      return [`#${id} ${anchor.document} (whole doc)`];
    case "passage": {
      const range =
        anchor.startLine === anchor.endLine ? `${anchor.startLine}` : `${anchor.startLine}-${anchor.endLine}`;
      const location = `#${id} ${anchor.document}:${range}${anchor.outdated ? " (outdated)" : ""}`;
      if (anchor.outdated) {
        return [location, `  quote: ${formatQuote(anchor.quote)}`];
      }
      const original = anchor.anchoredText === anchor.quote ? [] : [`  was: ${formatQuote(anchor.quote)}`];
      return [location, `  quote: ${formatQuote(anchor.anchoredText)}`, ...original];
    }
  }
}

function summaryLine(approved: boolean, threads: readonly Thread[]): string {
  if (threads.length === 0) {
    return approved ? "Review approved. No threads need you." : "No threads need you.";
  }
  const counts = new Map<string, number>();
  for (const thread of threads) {
    const group = thread.anchor.kind === "review" ? "review" : thread.anchor.document;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const breakdown = [...counts].map(([group, count]) => `${group}: ${count}`).join(", ");
  const needs = threads.length === 1 ? "1 thread needs you" : `${threads.length} threads need you`;
  return approved ? `Review approved, ${needs} (${breakdown})` : `${needs} (${breakdown})`;
}

function nextStep(approved: boolean, ids: readonly number[]): string {
  if (ids.length === 0) {
    return approved ? approvedStep : waitForCommentsStep;
  }
  return approved ? approvedWithCommentsStep(ids) : addressThreadsStep(ids);
}

function orderByDocument(threads: readonly Thread[]): Thread[] {
  const groupOf = (thread: Thread): string => (thread.anchor.kind === "review" ? "￿" : thread.anchor.document);
  return [...threads].sort((left, right) => groupOf(left).localeCompare(groupOf(right)) || left.id - right.id);
}

function formatQuote(text: string): string {
  const shortened =
    text.length > longQuoteLength ? `${text.slice(0, quoteStartLength)}…${text.slice(-quoteEndLength)}` : text;
  return JSON.stringify(shortened);
}

function indentContinuation(text: string, indent: string): string {
  return text.split("\n").join(`\n${indent}`);
}
````

`src/cli/formatAgentAction.ts`:

````ts
import type { AgentThreadResponse } from "../shared/api/apiResponseSchemas";

import { formatIdList } from "./formatIdList";
import { approvedStep } from "./nextSteps";

/**
 * Confirms an agent reply or resolve and says what is left
 *
 * @param action what the agent did
 * @param response the thread after the action and the inbox that remains
 * @returns the confirmation, the threads still needing the agent, and a `next_step`
 */
export function formatAgentAction(action: "replied" | "resolved", { inbox, thread }: AgentThreadResponse): string {
  const done = action === "resolved" ? `Resolved #${thread.id}.` : `Replied to #${thread.id}; it waits for the user.`;
  const remaining = inbox.threads.map((remainingThread) => remainingThread.id);
  if (remaining.length > 0) {
    const count = remaining.length === 1 ? "1 thread still needs you" : `${remaining.length} threads still need you`;
    return (
      `${done}\n${count}: ${formatIdList(remaining)}.\n\nnext_step: Address ${formatIdList(remaining)}, then run ` +
      '`markdown-review resolve <id> "<what changed>"`, or `markdown-review reply <id> "<question>"` if you need input.\n'
    );
  }
  const step = inbox.review.approved
    ? approvedStep
    : "Run `markdown-review poll` to wait for the user's next round of comments.";
  return `${done} No threads need you now.\n\nnext_step: ${step}\n`;
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/cli`, then `pnpm verify`
Expected: 16 tests pass in `src/cli`; `pnpm verify` is clean with 307 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Format the CLI's output for agents"
```

---

### Task 10: Find, start and talk to the root's server

**Files:**
- Create: `src/cli/CliError.ts`, `ServerRequestError.ts`, `ServerClient.ts`, `findRoot.ts`, `findServer.ts`, `withStartLock.ts`, `connectToServer.ts` (in `src/cli/`)
- Modify: `src/server/store/storePaths.ts` (add `serverLockPath` and `serverLogPath`; final version)
- Test: `src/cli/ServerClient.test.ts`, `findRoot.test.ts`, `withStartLock.test.ts`, `connectToServer.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 8 (`runServer`, `serverFileSchema`, `serverFilePath`) and plan 1's `readStoreFile`.
- Produces:
  - `class CliError extends Error { readonly exitCode: number; readonly nextStep: string }`, with `constructor(message, nextStep, exitCode = 1)`.
  - `class ServerRequestError extends Error { readonly reason: string; readonly status: number }`.
  - `class ServerClient` with `readonly port` and `health()`, `open(document | null)`, `inbox(document | null)`, `poll(document | null, timeoutSeconds, signal)`, `reply(id, body)`, `resolve(id, body | null)`, `shutdown()`. It throws `ServerRequestError` for refusals and unreadable responses.
  - `findRoot(directory): Promise<string>`: the real path of the git root, or of the directory outside git.
  - `type FoundServer = { kind: "absent" } | { kind: "ready"; client } | { kind: "older"; client } | { kind: "newer"; health }`; `findServer(root)`.
  - `withStartLock(root, task)`.
  - `connectToServer(root, cliPath): Promise<ServerClient>` and `waitUntilStopped(client): Promise<void>`.
  - `serverLockPath(root)`, `serverLogPath(root)`.

- [ ] **Step 1: Write the failing tests**

`src/cli/ServerClient.test.ts`:

````ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createMemoryLogger } from "../server/logging/testing/createMemoryLogger";
import type { RunningServer } from "../server/runtime/runServer";
import { runServer } from "../server/runtime/runServer";
import { serverFileSchema } from "../server/runtime/serverFileSchema";
import { serverFilePath } from "../server/store/storePaths";
import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { ServerClient } from "./ServerClient";

const getDirectory = setUpTemporaryDirectory();

let running: RunningServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe("ServerClient", () => {
  test("must read the server's health and the inbox when it has the server's token", async () => {
    const { client, root } = await setUpTest();

    expect((await client.health()).root).toBe(root);
    expect(await client.inbox(null)).toMatchObject({ problems: [], threads: [] });
  });

  test("must start a round and return the doc's URL when the agent opens a doc", async () => {
    const { client } = await setUpTest();

    const opened = await client.open("docs/plan.md");

    expect(opened).toMatchObject({ navigated: false, url: `http://127.0.0.1:${client.port}/document/docs/plan.md` });
    expect(opened.review.requestedAt).not.toBeNull();
  });

  test("must return an empty, timed-out inbox when a poll's timeout passes with nothing to do", async () => {
    const { client } = await setUpTest();

    const result = await client.poll(null, 0, new AbortController().signal);

    expect(result).toMatchObject({ threads: [], timedOut: true });
  });

  test("must raise the server's reason when the server refuses a request", async () => {
    const { client } = await setUpTest();

    await expect(client.reply(99, "Done")).rejects.toMatchObject({ reason: "unknown-thread", status: 404 });
  });

  test("must be refused when its token is wrong", async () => {
    const { port } = await setUpTest();

    await expect(new ServerClient(port, "c".repeat(64)).inbox(null)).rejects.toMatchObject({ reason: "unauthorized" });
  });

  test("must stop the server when it asks the server to shut down", async () => {
    const { client, server } = await setUpTest();

    await client.shutdown();

    await expect(server.closed).resolves.toBeUndefined();
  });
});

async function setUpTest() {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  const server = await runServer({ logger: createMemoryLogger().logger, root });
  running = server;
  const { port, token } = serverFileSchema.parse(JSON.parse(await readFile(serverFilePath(root), "utf8")));
  const client = new ServerClient(port, token);
  return { client, port, root, server };
}
````

`src/cli/findRoot.test.ts`:

````ts
import { execFile } from "node:child_process";
import { mkdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { findRoot } from "./findRoot";

const runCommand = promisify(execFile);

const getDirectory = setUpTemporaryDirectory();

describe("findRoot", () => {
  test("must return the repository root when the directory is deep inside a git repository", async () => {
    const root = await realpath(getDirectory());
    await runCommand("git", ["init", "-q"], { cwd: root });
    await mkdir(path.join(root, "docs", "plans"), { recursive: true });

    expect(await findRoot(path.join(root, "docs", "plans"))).toBe(root);
  });

  test("must return the directory itself when it is not in a git repository", async () => {
    const directory = await realpath(getDirectory());

    expect(await findRoot(directory)).toBe(directory);
  });
});
````

`src/cli/withStartLock.test.ts`:

````ts
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { withStartLock } from "./withStartLock";

const getDirectory = setUpTemporaryDirectory();

describe("withStartLock", () => {
  test("must run one task at a time and remove the lock afterwards when two commands start together", async () => {
    const root = await setUpTest();
    let running = 0;
    let mostAtOnce = 0;
    const task = async (): Promise<void> => {
      running += 1;
      mostAtOnce = Math.max(mostAtOnce, running);
      await new Promise((resolve) => setTimeout(resolve, 50));
      running -= 1;
    };

    await Promise.all([withStartLock(root, task), withStartLock(root, task)]);

    expect(mostAtOnce).toBe(1);
    await expect(stat(lockPath(root))).rejects.toMatchObject({ code: "ENOENT" });
  });

  test("must take over the lock when the process that held it has exited", async () => {
    const root = await setUpTest();
    await writeFile(lockPath(root), "999999");

    const result = await withStartLock(root, async () => readFile(lockPath(root), "utf8"));

    expect(result).toBe(String(process.pid));
  });
});

async function setUpTest(): Promise<string> {
  const root = getDirectory();
  await mkdir(path.join(root, ".markdown-review"));
  return root;
}

function lockPath(root: string): string {
  return path.join(root, ".markdown-review", "server.lock");
}
````

`src/cli/connectToServer.test.ts`:

````ts
import { mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";

import { createMemoryLogger } from "../server/logging/testing/createMemoryLogger";
import { runServer } from "../server/runtime/runServer";
import { serverFilePath } from "../server/store/storePaths";
import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { CliError } from "./CliError";
import { connectToServer, waitUntilStopped } from "./connectToServer";

const getDirectory = setUpTemporaryDirectory();

const cleanUps: (() => Promise<void>)[] = [];

afterEach(async () => {
  for (const cleanUp of cleanUps.splice(0)) {
    await cleanUp();
  }
});

describe("connectToServer", () => {
  test("must connect to the root's running server instead of starting another", async () => {
    const root = await createRoot();
    const server = await runServer({ logger: createMemoryLogger().logger, root });
    cleanUps.push(() => server.close());

    const client = await connectToServer(root, path.join(root, "unused-cli.js"));

    expect(client.port).toBe(server.port);
  });

  test("must refuse to replace a server that speaks a newer protocol", async () => {
    const root = await createRoot();
    await startNewerServer(root);

    await expect(connectToServer(root, path.join(root, "unused-cli.js"))).rejects.toBeInstanceOf(CliError);
  });
});

describe("waitUntilStopped", () => {
  test("must return once the server no longer answers after it has been asked to stop", async () => {
    const root = await createRoot();
    const server = await runServer({ logger: createMemoryLogger().logger, root });
    const client = await connectToServer(root, path.join(root, "unused-cli.js"));

    await client.shutdown();
    await waitUntilStopped(client);

    await expect(client.health()).rejects.toThrow();
    await server.closed;
  });
});

async function createRoot(): Promise<string> {
  const root = path.join(getDirectory(), "repo");
  await mkdir(path.join(root, ".markdown-review"), { recursive: true });
  return root;
}

async function startNewerServer(root: string): Promise<void> {
  const fake = createServer((_request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ name: "markdown-review", pid: 999_999, protocol: 99, root, version: "9.9.9" }));
  });
  await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
  cleanUps.push(() => new Promise((resolve) => fake.close(() => resolve())));
  const address = fake.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  const serverFile = {
    pid: 999_999,
    port,
    protocol: 99,
    root,
    startedAt: new Date().toISOString(),
    token: "b".repeat(64),
    version: "9.9.9",
  };
  await writeFile(serverFilePath(root), JSON.stringify(serverFile));
}
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/cli`
Expected: the four new files FAIL with `Cannot find module` for `./ServerClient`, `./findRoot`, `./withStartLock` and `./CliError` (from `connectToServer.test.ts`).

- [ ] **Step 3: Write the errors, the lock paths and the client**

Replace `src/server/store/storePaths.ts` with:

````ts
import path from "node:path";

const storeDirectoryName = ".markdown-review";

export function storeDirectory(root: string): string {
  return path.join(root, storeDirectoryName);
}

export function reviewFilePath(root: string): string {
  return path.join(storeDirectory(root), "review.json");
}

export function serverFilePath(root: string): string {
  return path.join(storeDirectory(root), "server.json");
}

export function serverLockPath(root: string): string {
  return path.join(storeDirectory(root), "server.lock");
}

export function serverLogPath(root: string): string {
  return path.join(storeDirectory(root), "server.log");
}

export function documentsDirectory(root: string): string {
  return path.join(storeDirectory(root), "documents");
}

/**
 * Locates the file holding a doc's threads
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path, e.g. "docs/plan.md"
 * @returns where the doc's threads are stored, e.g. "<root>/.markdown-review/documents/docs/plan.md.json"
 */
export function documentThreadsFilePath(root: string, document: string): string {
  return path.join(documentsDirectory(root), ...`${document}.json`.split("/"));
}

/**
 * Locates a doc's source on disk
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path
 * @returns the doc's path on disk
 */
export function documentSourcePath(root: string, document: string): string {
  return path.join(root, ...document.split("/"));
}
````

`src/cli/CliError.ts`:

````ts
/**
 * A command that cannot finish, with the `next_step` that tells the agent what to do about it
 */
export class CliError extends Error {
  public readonly exitCode: number;
  public readonly nextStep: string;

  public constructor(message: string, nextStep: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.nextStep = nextStep;
  }
}
````

`src/cli/ServerRequestError.ts`:

````ts
/**
 * A request the review server refused or answered with something the CLI cannot read
 */
export class ServerRequestError extends Error {
  public readonly reason: string;
  public readonly status: number;

  public constructor(status: number, reason: string, message: string) {
    super(message);
    this.name = "ServerRequestError";
    this.reason = reason;
    this.status = status;
  }
}
````

`src/cli/ServerClient.ts`:

````ts
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
````

- [ ] **Step 4: Write root finding, server discovery, the lock and the connection**

`src/cli/findRoot.ts`:

````ts
import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import { promisify } from "node:util";

const runCommand = promisify(execFile);

/**
 * Finds the root a directory's reviews belong to
 *
 * @param directory an existing directory
 * @returns the real path of the git repository (or worktree) root holding the directory, or of the directory itself
 *   when it is not in a git repository
 */
export async function findRoot(directory: string): Promise<string> {
  try {
    const { stdout } = await runCommand("git", ["rev-parse", "--show-toplevel"], { cwd: directory });
    return await realpath(stdout.trim());
  } catch {
    return realpath(directory);
  }
}
````

`src/cli/findServer.ts`:

````ts
import type { Health } from "../shared/api/apiResponseSchemas";
import { protocolVersion } from "../shared/api/protocolVersion";
import { serverFileSchema } from "../server/runtime/serverFileSchema";
import { readStoreFile } from "../server/store/readStoreFile";
import { serverFilePath } from "../server/store/storePaths";

import { ServerClient } from "./ServerClient";

export type FoundServer =
  | { kind: "absent" }
  | { kind: "ready"; client: ServerClient }
  | { kind: "older"; client: ServerClient }
  | { kind: "newer"; health: Health };

/**
 * Looks for a server already serving the root, using `.markdown-review/server.json`
 *
 * @param root the root's real path
 * @returns "ready" for a healthy server of this protocol, "older" or "newer" for one of another protocol, and
 *   "absent" when there is no record, the recorded server does not answer, or it serves another root
 */
export async function findServer(root: string): Promise<FoundServer> {
  const recorded = await readStoreFile(serverFilePath(root), serverFileSchema);
  if (recorded.kind === "invalid" || recorded.value === null) {
    return { kind: "absent" };
  }
  const client = new ServerClient(recorded.value.port, recorded.value.token);
  let health: Health;
  try {
    health = await client.health();
  } catch {
    return { kind: "absent" };
  }
  if (health.root !== root) {
    return { kind: "absent" };
  }
  if (health.protocol < protocolVersion) {
    return { client, kind: "older" };
  }
  return health.protocol > protocolVersion ? { health, kind: "newer" } : { client, kind: "ready" };
}
````

`src/cli/withStartLock.ts`:

````ts
import { readFile, rm, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { serverLockPath } from "../server/store/storePaths";

import { CliError } from "./CliError";

const lockWaitMilliseconds = 15_000;

const lockRetryMilliseconds = 100;

/**
 * Runs a task while holding `.markdown-review/server.lock`, so only one command at a time starts the root's server
 *
 * @param root the root's real path; its `.markdown-review/` directory must exist
 * @param task what to do while holding the lock
 * @returns the task's result
 * @throws CliError when another live process holds the lock for longer than 15 seconds
 */
export async function withStartLock<Result>(root: string, task: () => Promise<Result>): Promise<Result> {
  const lockPath = serverLockPath(root);
  const deadline = Date.now() + lockWaitMilliseconds;
  while (!(await tryCreateLock(lockPath))) {
    if (await isStaleLock(lockPath)) {
      await rm(lockPath, { force: true });
    } else if (Date.now() > deadline) {
      throw new CliError(
        `Another markdown-review command has been starting the server for ${root} for over 15 seconds`,
        `Wait for it to finish, or delete ${lockPath} if no other markdown-review command is running, then try again.`
      );
    } else {
      await delay(lockRetryMilliseconds);
    }
  }
  try {
    return await task();
  } finally {
    await rm(lockPath, { force: true });
  }
}

async function tryCreateLock(lockPath: string): Promise<boolean> {
  try {
    await writeFile(lockPath, String(process.pid), { flag: "wx" });
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") {
      return false;
    }
    throw error;
  }
}

/**
 * Tells whether the lock's owner has exited without removing it
 */
async function isStaleLock(lockPath: string): Promise<boolean> {
  let owner: number;
  try {
    owner = Number(await readFile(lockPath, "utf8"));
  } catch {
    return false;
  }
  if (!Number.isInteger(owner) || owner <= 0) {
    return false;
  }
  try {
    process.kill(owner, 0);
    return false;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ESRCH";
  }
}
````

`src/cli/connectToServer.ts`:

````ts
import { spawn } from "node:child_process";
import { mkdir, open } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

import { serverLogPath, storeDirectory } from "../server/store/storePaths";

import { CliError } from "./CliError";
import { findServer } from "./findServer";
import type { ServerClient } from "./ServerClient";
import { withStartLock } from "./withStartLock";

const startWaitMilliseconds = 10_000;

const stopWaitMilliseconds = 5_000;

const checkIntervalMilliseconds = 100;

/**
 * Connects to the root's review server, starting one when none is running and replacing one of an older protocol
 *
 * @param root the root's real path
 * @param cliPath the built CLI, which the server is started from
 * @returns a client for the running server
 * @throws CliError when a newer markdown-review is serving the root, or the server does not start
 */
export async function connectToServer(root: string, cliPath: string): Promise<ServerClient> {
  const found = await findServer(root);
  switch (found.kind) {
    case "ready":
      return found.client;
    case "newer":
      throw new CliError(
        `A newer markdown-review (version ${found.health.version}, protocol ${found.health.protocol}) is serving ${root}`,
        "Run the newer markdown-review, for example `npx @krelborn/markdown-review@latest <command>`, or stop its server with it."
      );
    case "older":
      await found.client.shutdown();
      await waitUntilStopped(found.client);
      break;
    case "absent":
      break;
  }
  await mkdir(storeDirectory(root), { recursive: true });
  return withStartLock(root, async () => {
    const recheck = await findServer(root);
    if (recheck.kind === "ready") {
      return recheck.client;
    }
    await spawnServer(root, cliPath);
    return waitUntilReady(root);
  });
}

/**
 * Waits for a server to stop answering, after asking it to shut down
 *
 * @param client the server's client
 */
export async function waitUntilStopped(client: ServerClient): Promise<void> {
  const deadline = Date.now() + stopWaitMilliseconds;
  while (Date.now() < deadline) {
    try {
      await client.health();
    } catch {
      return;
    }
    await delay(checkIntervalMilliseconds);
  }
}

async function spawnServer(root: string, cliPath: string): Promise<void> {
  const log = await open(serverLogPath(root), "a");
  try {
    const child = spawn(process.execPath, [cliPath, "serve", "--root", root], {
      detached: true,
      stdio: ["ignore", log.fd, log.fd],
    });
    child.unref();
  } finally {
    await log.close();
  }
}

async function waitUntilReady(root: string): Promise<ServerClient> {
  const deadline = Date.now() + startWaitMilliseconds;
  while (Date.now() < deadline) {
    const found = await findServer(root);
    if (found.kind === "ready") {
      return found.client;
    }
    await delay(checkIntervalMilliseconds);
  }
  throw new CliError(
    `The review server for ${root} did not start within 10 seconds`,
    `Read ${serverLogPath(root)}, fix what it reports, and run the command again.`
  );
}
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test src/cli`, then `pnpm verify`
Expected: 13 new tests pass, including the Review Focus lock test; `pnpm verify` is clean with 320 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Find, start and talk to the root's review server"
```

---

### Task 11: The CLI commands and the build

**Files:**
- Create:
  - `src/cli/`: `CliTerminal.ts`, `CliContext.ts`, `helpText.ts`, `toRepositoryPath.ts`, `readDocumentOption.ts`, `readMessageBody.ts`, `readThreadIdArgument.ts`, `runCli.ts`, `createProcessTerminal.ts`, `main.ts`
  - `src/cli/commands/`: `openCommand.ts`, `inboxCommand.ts`, `pollCommand.ts`, `agentThreadCommands.ts`, `stopCommand.ts`, `serveCommand.ts`
  - `src/server/runtime/createConsoleLogger.ts`, `vite.config.mts`
- Modify: `src/cli/nextSteps.ts` (export `pollTimeoutAdvice`), `tsconfig.node.json`, `package.json`, `.fallowrc.json`
- Test: `src/cli/runCli.test.ts`, `src/cli/toRepositoryPath.test.ts`, `src/cli/readThreadIdArgument.test.ts`

**Interfaces:**
- Consumes: Tasks 8 to 10.
- Produces:
  - `interface CliTerminal { workingDirectory; env; readStdin(); stderr(text); stdout(text) }` and `interface CliContext { cliPath: string; terminal: CliTerminal }`.
  - `runCli(commandLine: string[], context: CliContext): Promise<number>`: `--version`, `--help`, `<command> --help`, and the commands `open`, `inbox`, `poll`, `reply`, `resolve`, `stop` and `serve`.
  - `main.ts` (the bin entry), `createProcessTerminal()`, `createConsoleLogger(): Logger`.
  - `dist/cli.js` from `pnpm build`.

- [ ] **Step 1: Add `open`, the build script and the bin entry**

```bash
pnpm add open
```

In `package.json`, add `"build": "vite build"` as the first script, and these two top-level fields:

````json
  "bin": {
    "markdown-review": "dist/cli.js"
  },
  "files": [
    "dist"
  ],
````

Then run `pnpm format`, which puts the fields in oxfmt's order.

`vite.config.mts`:

````ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rolldownOptions: { output: { entryFileNames: "cli.js" } },
    ssr: "src/cli/main.ts",
    target: "node22",
  },
});
````

Replace `tsconfig.node.json` with:

````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "nodenext",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true
  },
  "include": ["vite.config.mts", "vitest.config.mts"]
}
````

Replace `.fallowrc.json` with:

````json
{
  "$schema": "https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json",
  "entry": ["src/cli/main.ts"]
}
````

- [ ] **Step 2: Write the failing tests**

`src/cli/runCli.test.ts`:

````ts
import { execFile } from "node:child_process";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createMemoryLogger } from "../server/logging/testing/createMemoryLogger";
import { packageVersion } from "../server/runtime/packageVersion";
import type { RunningServer } from "../server/runtime/runServer";
import { runServer } from "../server/runtime/runServer";
import { setUpTemporaryDirectory } from "../server/testing/setUpTemporaryDirectory";

import { runCli } from "./runCli";

const runCommand = promisify(execFile);

const getDirectory = setUpTemporaryDirectory();

let running: RunningServer | undefined;

afterEach(async () => {
  await running?.close();
  running = undefined;
});

describe("runCli", () => {
  test("must print the package version when asked for it", async () => {
    const { run } = await setUpTest();

    expect(await run(["--version"])).toEqual({ exitCode: 0, stderr: "", stdout: `${packageVersion}\n` });
  });

  test("must print one command's usage when the command is given --help", async () => {
    const { run } = await setUpTest();

    const { exitCode, stdout } = await run(["poll", "--help"]);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^markdown-review poll \[--document <path>\] \[--timeout <seconds>\]\n/);
  });

  test.each([
    { condition: "no command is given", args: [], message: "error: no command given" },
    { condition: "the command is unknown", args: ["approve"], message: "error: unknown command approve" },
    { condition: "an option is unknown", args: ["poll", "--wait"], message: "error: Unknown option '--wait'" },
    { condition: "the thread ID is not a number", args: ["resolve", "abc"], message: "error: Expected a thread ID" },
    { condition: "a reply has no text", args: ["reply", "1"], message: "error: reply needs the text of the reply" },
    {
      condition: "the poll timeout is not a number",
      args: ["poll", "--timeout", "soon"],
      message: "error: --timeout must be",
    },
  ])("must exit 2 with the error and a next_step when $condition", async ({ args, message }) => {
    const { run } = await setUpTest();

    const { exitCode, stderr } = await run(args);

    expect(exitCode).toBe(2);
    expect(stderr.startsWith(message)).toBe(true);
    expect(stderr).toContain("next_step: ");
  });

  test("must exit 1 and say how to fix the path when the doc to open does not exist", async () => {
    const { run } = await setUpTest();

    const { exitCode, stderr } = await run(["open", "docs/missing.md"]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "error: docs/missing.md is not a file\n\nnext_step: Check the path and run `markdown-review open <path>` again.\n"
    );
  });

  test("must use the running server and print the inbox when the agent checks it", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stdout } = await run(["inbox"]);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^No threads need you\.\n\nnext_step: Run `markdown-review poll`/);
  });

  test("must say there are no comments yet when the poll times out", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stderr, stdout } = await run(["poll", "--timeout", "1"]);

    expect(exitCode).toBe(0);
    expect(stderr).toContain("Waiting up to 1s for review comments.");
    expect(stdout).toMatch(/^No comments yet\./);
  });

  test("must tell the agent to poll again when the server stops while the poll waits", async () => {
    const { start } = await setUpTest({ withServer: true });
    const poll = start(["poll", "--timeout", "20"]);
    await vi.waitFor(() => expect(poll.stderr()).toContain("Waiting up to 20s"));

    await running?.close();

    expect(await poll.exitCode).toBe(1);
    expect(poll.stderr()).toContain(
      "error: The review server stopped while you were waiting\n\nnext_step: Run `markdown-review poll` again; it starts the server again and nothing was lost.\n"
    );
  });

  test("must say no threads need the agent when it resolves a thread that does not exist", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stderr } = await run(["resolve", "99", "Done"]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "error: No thread #99 is waiting for you. No threads need you.\n\nnext_step: Run `markdown-review inbox` to see them.\n"
    );
  });

  test("must pass on the server's reason when the server refuses the request", async () => {
    const { run } = await setUpTest({ withServer: true });

    const { exitCode, stderr } = await run(["inbox", "--document", "../outside.md"]);

    expect(exitCode).toBe(1);
    expect(stderr).toContain("is not a file inside the repository");
  });
});

async function setUpTest({ withServer = false }: { withServer?: boolean } = {}) {
  const root = await realpath(getDirectory());
  await runCommand("git", ["init", "-q"], { cwd: root });
  await mkdir(path.join(root, "docs"));
  await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
  if (withServer) {
    running = await runServer({ logger: createMemoryLogger().logger, root });
  }
  const start = (args: string[]) => {
    let stdout = "";
    let stderr = "";
    const exitCode = runCli(args, {
      cliPath: path.join(root, "unused-cli.js"),
      terminal: {
        workingDirectory: root,
        env: { MARKDOWN_REVIEW_NO_BROWSER: "1" },
        readStdin: async () => "",
        stderr: (text) => {
          stderr += text;
        },
        stdout: (text) => {
          stdout += text;
        },
      },
    });
    return { exitCode, stderr: () => stderr, stdout: () => stdout };
  };
  const run = async (args: string[]) => {
    const started = start(args);
    const exitCode = await started.exitCode;
    return { exitCode, stderr: started.stderr(), stdout: started.stdout() };
  };
  return { root, run, start };
}
````

`src/cli/toRepositoryPath.test.ts`:

````ts
import path from "node:path";
import { describe, expect, test } from "vitest";

import { CliError } from "./CliError";
import { toRepositoryPath } from "./toRepositoryPath";

const root = path.join(path.sep, "work", "repo");

describe("toRepositoryPath", () => {
  test("must return a POSIX path relative to the root when the path is inside the root", () => {
    expect(toRepositoryPath(root, path.join(root, "docs", "plan.md"))).toBe("docs/plan.md");
  });

  test.each([
    { condition: "the path is outside the root", absolutePath: path.join(path.sep, "work", "other.md") },
    { condition: "the path is the root itself", absolutePath: root },
  ])("must refuse the path when $condition", ({ absolutePath }) => {
    expect(() => toRepositoryPath(root, absolutePath)).toThrow(CliError);
  });
});
````

`src/cli/readThreadIdArgument.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { CliError } from "./CliError";
import { readThreadIdArgument } from "./readThreadIdArgument";

describe("readThreadIdArgument", () => {
  test.each([
    { value: "14", expected: 14 },
    { value: "#14", expected: 14 },
  ])("must read the ID when the argument is '$value'", ({ value, expected }) => {
    expect(readThreadIdArgument(value, "markdown-review resolve <id>")).toBe(expected);
  });

  test.each([{ value: undefined }, { value: "0" }, { value: "fourteen" }])(
    "must refuse the argument when it is $value",
    ({ value }) => {
      expect(() => readThreadIdArgument(value, "markdown-review resolve <id>")).toThrow(CliError);
    }
  );
});
````

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test src/cli`
Expected: FAIL with `Cannot find module` for `./runCli`, `./toRepositoryPath` and `./readThreadIdArgument`.

- [ ] **Step 4: Write the CLI's plumbing**

Replace `src/cli/nextSteps.ts` with (only `export` on `pollTimeoutAdvice` changes):

````ts
import { formatIdList } from "./formatIdList";

export const pollTimeoutAdvice =
  "Give the shell command a timeout of at least 600000 ms, or in Claude Code run it with run_in_background and `--timeout 7080`.";

export const waitForCommentsStep = `Run \`markdown-review poll\` to wait for the user's comments. ${pollTimeoutAdvice}`;

export const approvedStep =
  "The user approved the review. Carry on with your task; do not run `markdown-review poll` again for this review.";

/**
 * @param ids the threads that need the agent, at least one
 */
export function addressThreadsStep(ids: readonly number[]): string {
  return (
    `Edit the docs, then run \`markdown-review resolve <id> "<what changed>"\` for ${formatIdList(ids)}, ` +
    'or `markdown-review reply <id> "<question>"` if you need input. ' +
    "Then run `markdown-review poll` to wait for the next round."
  );
}

/**
 * @param ids the threads the user commented on when approving, at least one
 */
export function approvedWithCommentsStep(ids: readonly number[]): string {
  const resolveCommand =
    ids.length === 1
      ? `\`markdown-review resolve ${ids[0]} "<what changed>"\``
      : '`markdown-review resolve <id> "<what changed>"` for each';
  return (
    `The user approved the review with comments. Address ${formatIdList(ids)} and run ${resolveCommand}, ` +
    "then carry on with your task; do not run `markdown-review poll` again for this review."
  );
}
````

`src/cli/CliTerminal.ts`:

````ts
/**
 * Where a command reads from and writes to, so commands can run outside a real process
 */
export interface CliTerminal {
  workingDirectory: string;
  env: Partial<Record<string, string>>;
  readStdin(): Promise<string>;
  stderr(text: string): void;
  stdout(text: string): void;
}
````

`src/cli/CliContext.ts`:

````ts
import type { CliTerminal } from "./CliTerminal";

export interface CliContext {
  /**
   * The built CLI's own path, which starts the server as `node <cliPath> serve`
   */
  cliPath: string;

  terminal: CliTerminal;
}
````

`src/cli/helpText.ts`:

````ts
const commandHelp: Record<string, string> = {
  inbox: [
    "markdown-review inbox [--document <path>]",
    "  Print whether the review is approved and the threads that need you, then return at once.",
  ].join("\n"),
  open: [
    "markdown-review open [path]",
    "  Start a review round and show the doc (or the docs list) in the user's browser. Prints the URL.",
  ].join("\n"),
  poll: [
    "markdown-review poll [--document <path>] [--timeout <seconds>]",
    "  Wait until the user submits or approves, then print what needs you. The timeout defaults to 540 seconds.",
    "  Give the shell command a timeout of at least 600000 ms, or in Claude Code run it with run_in_background",
    "  and --timeout 7080.",
  ].join("\n"),
  reply: [
    "markdown-review reply <id> <text>",
    "markdown-review reply <id> --file <path>   (--file - reads standard input)",
    "  Answer a thread without resolving it, for example to ask the user a question.",
  ].join("\n"),
  resolve: [
    "markdown-review resolve <id> [text]",
    "markdown-review resolve <id> --file <path>   (--file - reads standard input)",
    "  Resolve a thread, optionally saying what changed.",
  ].join("\n"),
  stop: ["markdown-review stop", "  Stop the review server for this repository."].join("\n"),
};

/**
 * @param command a command name, or undefined for every command
 * @returns usage text for the command, or for the whole CLI
 */
export function helpText(command?: string): string {
  const named = command === undefined ? undefined : commandHelp[command];
  if (named !== undefined) {
    return `${named}\n`;
  }
  return [
    "Markdown Review: the user reviews your markdown in a browser; you read and answer their comments here.",
    "",
    ...Object.values(commandHelp),
    "",
    "Run `markdown-review <command> --help` for one command. Every command ends with a next_step line.",
    "",
  ].join("\n");
}
````

`src/cli/toRepositoryPath.ts`:

````ts
import path from "node:path";

import { CliError } from "./CliError";

/**
 * Turns a path the agent typed into the repo-relative POSIX path the server uses
 *
 * @param root the root's real path
 * @param absolutePath the path, already resolved against the working directory
 * @throws CliError when the path is outside the root
 */
export function toRepositoryPath(root: string, absolutePath: string): string {
  const relativePath = path.relative(root, absolutePath);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new CliError(
      `${absolutePath} is not a file inside the repository at ${root}`,
      "Pass a path to a markdown file inside the repository."
    );
  }
  return relativePath.split(path.sep).join("/");
}
````

`src/cli/readDocumentOption.ts`:

````ts
import { realpath } from "node:fs/promises";
import path from "node:path";

import { toRepositoryPath } from "./toRepositoryPath";

/**
 * Reads a `--document <path>` option, which may be relative to the working directory
 *
 * @param root the root's real path
 * @param workingDirectory the directory the command runs in
 * @param value the option's value, if it was given
 * @returns the doc's repo-relative POSIX path, or null when the option was not given
 */
export async function readDocumentOption(
  root: string,
  workingDirectory: string,
  value: string | undefined
): Promise<string | null> {
  return value === undefined ? null : toRepositoryPath(root, path.resolve(await realpath(workingDirectory), value));
}
````

`src/cli/readMessageBody.ts`:

````ts
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CliTerminal } from "./CliTerminal";

/**
 * Reads a reply or resolve message from the command's words or from `--file`
 *
 * @param words the words after the thread ID
 * @param file the `--file` option: a path, or "-" for standard input
 * @param terminal where standard input comes from
 * @returns the message, or null when neither was given
 */
export async function readMessageBody(
  words: readonly string[],
  file: string | undefined,
  terminal: CliTerminal
): Promise<string | null> {
  if (file === "-") {
    return terminal.readStdin();
  }
  if (file !== undefined) {
    return readFile(path.resolve(terminal.workingDirectory, file), "utf8");
  }
  return words.length === 0 ? null : words.join(" ");
}
````

`src/cli/readThreadIdArgument.ts`:

````ts
import { CliError } from "./CliError";

/**
 * @param value the command's first word
 * @param usage the command's usage line, for the error
 * @returns the thread ID
 * @throws CliError when the word is not a thread ID
 */
export function readThreadIdArgument(value: string | undefined, usage: string): number {
  if (value === undefined || !/^#?[1-9][0-9]*$/.test(value)) {
    throw new CliError(`Expected a thread ID such as 14, not ${value ?? "nothing"}`, `Run \`${usage}\`.`, 2);
  }
  return Number(value.replace("#", ""));
}
````

- [ ] **Step 5: Write the commands**

`src/cli/commands/openCommand.ts`:

````ts
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

import openInBrowser from "open";

import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { waitForCommentsStep } from "../nextSteps";
import { toRepositoryPath } from "../toRepositoryPath";

export async function openCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { positionals } = parseArgs({ allowPositionals: true, args, options: {} });
  if (positionals.length > 1) {
    throw new CliError("open takes at most one path", "Run `markdown-review open [path]`.", 2);
  }
  const target = positionals[0];
  const { document, root } =
    target === undefined
      ? { document: null, root: await findRoot(terminal.workingDirectory) }
      : await locate(terminal.workingDirectory, target);
  const client = await connectToServer(root, cliPath);
  const { navigated, url } = await client.open(document);
  const shown = navigated ? "Shown in the browser tab that was already open." : await openUrl(url, terminal.env);
  terminal.stdout(
    `Opened ${document ?? "the docs list"} for review: ${url}\n${shown}\n\nnext_step: ${waitForCommentsStep}\n`
  );
  return 0;
}

async function locate(workingDirectory: string, target: string): Promise<{ document: string; root: string }> {
  const absolutePath = path.resolve(workingDirectory, target);
  const found = await stat(absolutePath).catch(() => null);
  if (found === null || !found.isFile()) {
    throw new CliError(`${target} is not a file`, "Check the path and run `markdown-review open <path>` again.");
  }
  const root = await findRoot(path.dirname(absolutePath));
  return { document: toRepositoryPath(root, await realpath(absolutePath)), root };
}

async function openUrl(url: string, env: Partial<Record<string, string>>): Promise<string> {
  if (env.MARKDOWN_REVIEW_NO_BROWSER === "1") {
    return "Not opened in a browser because MARKDOWN_REVIEW_NO_BROWSER is set; give the user the URL.";
  }
  try {
    await openInBrowser(url);
    return "Opened in the user's browser.";
  } catch {
    return "Could not open a browser; give the user the URL.";
  }
}
````

`src/cli/commands/inboxCommand.ts`:

````ts
import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { formatInbox } from "../formatInbox";
import { readDocumentOption } from "../readDocumentOption";

export async function inboxCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { document: { type: "string" } } });
  const root = await findRoot(terminal.workingDirectory);
  const document = await readDocumentOption(root, terminal.workingDirectory, values.document);
  const client = await connectToServer(root, cliPath);
  terminal.stdout(formatInbox(await client.inbox(document)));
  return 0;
}
````

`src/cli/commands/pollCommand.ts`:

````ts
import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { formatInbox } from "../formatInbox";
import { pollTimeoutAdvice } from "../nextSteps";
import { readDocumentOption } from "../readDocumentOption";
import { ServerRequestError } from "../ServerRequestError";

const defaultTimeoutSeconds = 540;

const interruptedExitCodes: Record<string, number> = { SIGINT: 130, SIGTERM: 143 };

export async function pollCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { document: { type: "string" }, timeout: { type: "string" } } });
  const timeoutSeconds = readTimeout(values.timeout);
  const root = await findRoot(terminal.workingDirectory);
  const document = await readDocumentOption(root, terminal.workingDirectory, values.document);
  const client = await connectToServer(root, cliPath);
  terminal.stderr(
    `Waiting up to ${timeoutSeconds}s for review comments. If this is interrupted, run \`markdown-review poll\` again; nothing is lost.\n`
  );
  const abort = new AbortController();
  let interruptedBy: string | undefined;
  const onSignal = (signal: NodeJS.Signals): void => {
    interruptedBy = signal;
    abort.abort();
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);
  try {
    const result = await client.poll(document, timeoutSeconds, abort.signal);
    if (result.timedOut && result.threads.length === 0 && !result.review.approved) {
      terminal.stdout(
        `No comments yet.\n\nnext_step: Run \`markdown-review poll\` again to keep waiting. ${pollTimeoutAdvice}\n`
      );
    } else {
      terminal.stdout(formatInbox(result));
    }
    return 0;
  } catch (error) {
    if (interruptedBy !== undefined) {
      terminal.stderr(
        "Interrupted while waiting. Nothing was lost; run `markdown-review poll` again to keep waiting.\n"
      );
      return interruptedExitCodes[interruptedBy] ?? 1;
    }
    if (error instanceof ServerRequestError) {
      throw error;
    }
    throw new CliError(
      "The review server stopped while you were waiting",
      "Run `markdown-review poll` again; it starts the server again and nothing was lost."
    );
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}

function readTimeout(value: string | undefined): number {
  if (value === undefined) {
    return defaultTimeoutSeconds;
  }
  if (!/^[0-9]+$/.test(value)) {
    throw new CliError(
      `--timeout must be a whole number of seconds, not ${value}`,
      "Run `markdown-review poll --timeout 540`.",
      2
    );
  }
  return Number(value);
}
````

`src/cli/commands/agentThreadCommands.ts`:

````ts
import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import type { CliTerminal } from "../CliTerminal";
import { CliError } from "../CliError";
import { connectToServer } from "../connectToServer";
import { findRoot } from "../findRoot";
import { formatAgentAction } from "../formatAgentAction";
import { formatIdList } from "../formatIdList";
import { readMessageBody } from "../readMessageBody";
import { readThreadIdArgument } from "../readThreadIdArgument";
import type { ServerClient } from "../ServerClient";
import { ServerRequestError } from "../ServerRequestError";

export async function replyCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { id, message } = await readArguments(args, terminal, 'markdown-review reply <id> "<text>"');
  if (message === null) {
    throw new CliError("reply needs the text of the reply", 'Run `markdown-review reply <id> "<text>"`.', 2);
  }
  const client = await connectToServer(await findRoot(terminal.workingDirectory), cliPath);
  const response = await explainUnknownThread(client, id, () => client.reply(id, message));
  terminal.stdout(formatAgentAction("replied", response));
  return 0;
}

export async function resolveCommand(args: string[], { cliPath, terminal }: CliContext): Promise<number> {
  const { id, message } = await readArguments(args, terminal, 'markdown-review resolve <id> "<what changed>"');
  const client = await connectToServer(await findRoot(terminal.workingDirectory), cliPath);
  const response = await explainUnknownThread(client, id, () => client.resolve(id, message));
  terminal.stdout(formatAgentAction("resolved", response));
  return 0;
}

/**
 * Reads the thread ID and the message, before anything connects to the server
 */
async function readArguments(
  args: string[],
  terminal: CliTerminal,
  usage: string
): Promise<{ id: number; message: string | null }> {
  const { positionals, values } = parseArgs({ allowPositionals: true, args, options: { file: { type: "string" } } });
  const [idWord, ...words] = positionals;
  return { id: readThreadIdArgument(idWord, usage), message: await readMessageBody(words, values.file, terminal) };
}

/**
 * Turns the server's "unknown thread" into an error that lists the threads the agent can act on
 */
async function explainUnknownThread<Result>(
  client: ServerClient,
  id: number,
  action: () => Promise<Result>
): Promise<Result> {
  try {
    return await action();
  } catch (error) {
    if (!(error instanceof ServerRequestError) || error.reason !== "unknown-thread") {
      throw error;
    }
    const waiting = (await client.inbox(null)).threads.map((thread) => thread.id);
    const known =
      waiting.length === 0 ? "No threads need you." : `The threads that need you are ${formatIdList(waiting)}.`;
    throw new CliError(`No thread #${id} is waiting for you. ${known}`, "Run `markdown-review inbox` to see them.");
  }
}
````

`src/cli/commands/stopCommand.ts`:

````ts
import { parseArgs } from "node:util";

import type { CliContext } from "../CliContext";
import { waitUntilStopped } from "../connectToServer";
import { findRoot } from "../findRoot";
import { findServer } from "../findServer";

export async function stopCommand(args: string[], { terminal }: CliContext): Promise<number> {
  parseArgs({ args, options: {} });
  const root = await findRoot(terminal.workingDirectory);
  const found = await findServer(root);
  if (found.kind !== "ready" && found.kind !== "older") {
    terminal.stdout(
      `No review server is running for ${root} that this markdown-review can stop.\n\nnext_step: None.\n`
    );
    return 0;
  }
  await found.client.shutdown();
  await waitUntilStopped(found.client);
  terminal.stdout(
    `Stopped the review server for ${root}.\n\nnext_step: None; any markdown-review command starts it again.\n`
  );
  return 0;
}
````

`src/server/runtime/createConsoleLogger.ts`:

````ts
import type { Logger } from "../logging/Logger";

/**
 * Creates the server process's logger; the CLI points the process's output at `.markdown-review/server.log`
 *
 * @returns a logger that writes one timestamped line per entry
 */
export function createConsoleLogger(): Logger {
  const write = (level: string, message: string, error?: unknown): void => {
    const detail =
      error === undefined ? "" : ` ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
    process.stdout.write(`${new Date().toISOString()} ${level} ${message}${detail}\n`);
  };
  return {
    error: (message, error) => write("error", message, error),
    info: (message) => write("info", message),
    warn: (message, error) => write("warn", message, error),
  };
}
````

`src/cli/commands/serveCommand.ts`:

````ts
import { parseArgs } from "node:util";

import { createConsoleLogger } from "../../server/runtime/createConsoleLogger";
import { runServer } from "../../server/runtime/runServer";
import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";

/**
 * Runs the review server in this process until it stops; the CLI starts it detached as `serve --root <root>`
 */
export async function serveCommand(args: string[], _context: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { root: { type: "string" } } });
  if (values.root === undefined) {
    throw new CliError("serve needs --root <path>", "Run `markdown-review serve --root <repository root>`.", 2);
  }
  const server = await runServer({ logger: createConsoleLogger(), root: values.root });
  const stop = (): void => {
    server
      .close()
      .catch((error: unknown) => process.stderr.write(`The server did not stop cleanly: ${String(error)}\n`));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  await server.closed;
  return 0;
}
````

- [ ] **Step 6: Write the dispatcher and the entry point**

`src/cli/runCli.ts`:

````ts
import { packageVersion } from "../server/runtime/packageVersion";

import type { CliContext } from "./CliContext";
import { CliError } from "./CliError";
import { replyCommand, resolveCommand } from "./commands/agentThreadCommands";
import { inboxCommand } from "./commands/inboxCommand";
import { openCommand } from "./commands/openCommand";
import { pollCommand } from "./commands/pollCommand";
import { serveCommand } from "./commands/serveCommand";
import { stopCommand } from "./commands/stopCommand";
import { helpText } from "./helpText";
import { ServerRequestError } from "./ServerRequestError";

type Command = (args: string[], context: CliContext) => Promise<number>;

const commands: Record<string, Command> = {
  inbox: inboxCommand,
  open: openCommand,
  poll: pollCommand,
  reply: replyCommand,
  resolve: resolveCommand,
  serve: serveCommand,
  stop: stopCommand,
};

/**
 * Runs one CLI invocation
 *
 * @param commandLine the arguments after the program name
 * @param context where to write output and how to start the server
 * @returns the process exit code: 0 on success, 1 when the command failed, 2 for a usage error
 */
export async function runCli(commandLine: string[], context: CliContext): Promise<number> {
  const { terminal } = context;
  const [name, ...args] = commandLine;
  if (name === "--version") {
    terminal.stdout(`${packageVersion}\n`);
    return 0;
  }
  if (name === "--help" || name === "-h" || name === "help") {
    terminal.stdout(helpText());
    return 0;
  }
  if (name === undefined) {
    terminal.stderr(`error: no command given\n\n${helpText()}\nnext_step: Run one of the commands above.\n`);
    return 2;
  }
  const command = commands[name];
  if (command === undefined) {
    terminal.stderr(`error: unknown command ${name}\n\n${helpText()}\nnext_step: Run one of the commands above.\n`);
    return 2;
  }
  if (args.includes("--help") || args.includes("-h")) {
    terminal.stdout(helpText(name));
    return 0;
  }
  try {
    return await command(args, context);
  } catch (error) {
    return reportFailure(error, name, context);
  }
}

function reportFailure(error: unknown, name: string, { terminal }: CliContext): number {
  if (error instanceof CliError) {
    terminal.stderr(`error: ${error.message}\n\nnext_step: ${error.nextStep}\n`);
    return error.exitCode;
  }
  if (error instanceof ServerRequestError) {
    terminal.stderr(
      `error: the review server refused the request: ${error.message}\n\nnext_step: Fix what it reports and run the command again.\n`
    );
    return 1;
  }
  if (error instanceof TypeError && "code" in error && String(error.code).startsWith("ERR_PARSE_ARGS")) {
    terminal.stderr(`error: ${error.message}\n\nnext_step: Run \`markdown-review ${name} --help\`.\n`);
    return 2;
  }
  terminal.stderr(
    `error: ${error instanceof Error ? error.message : String(error)}\n\nnext_step: Run the command again; if it keeps failing, read .markdown-review/server.log.\n`
  );
  return 1;
}
````

`src/cli/createProcessTerminal.ts`:

````ts
import type { CliTerminal } from "./CliTerminal";

/**
 * Connects a CLI invocation to this process's working directory, environment and standard streams
 */
export function createProcessTerminal(): CliTerminal {
  return {
    workingDirectory: process.cwd(),
    env: process.env,
    readStdin: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString("utf8");
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    stdout: (text) => {
      process.stdout.write(text);
    },
  };
}
````

`src/cli/main.ts`:

````ts
#!/usr/bin/env node
import { fileURLToPath } from "node:url";

import { createProcessTerminal } from "./createProcessTerminal";
import { runCli } from "./runCli";

process.exitCode = await runCli(process.argv.slice(2), {
  cliPath: fileURLToPath(import.meta.url),
  terminal: createProcessTerminal(),
});
````

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm test src/cli`, then `pnpm verify`
Expected: 14 `runCli` tests pass, including the Review Focus case "must tell the agent to poll again when the server stops while the poll waits"; `pnpm verify` is clean with 342 tests.

- [ ] **Step 8: Build and try it**

```bash
pnpm build
```

Expected: `dist/cli.js` is built and its first line is `#!/usr/bin/env node`. Then, in a scratch git repository holding `docs/plan.md`:

```bash
MARKDOWN_REVIEW_NO_BROWSER=1 node <repo>/dist/cli.js open docs/plan.md
node <repo>/dist/cli.js inbox
node <repo>/dist/cli.js stop
```

Expected:
- `open` prints `Opened docs/plan.md for review: http://127.0.0.1:<port>/document/docs/plan.md` and a `next_step`.
- `inbox` prints `No threads need you.`
- `stop` prints `Stopped the review server for <root>.`
- `.markdown-review/server.json` existed with mode 0600 while the server ran, and is gone after `stop`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Add the agent's CLI commands and build it"
```

---

### Task 12: Drive the built CLI end to end

**Files:**
- Create: `src/integration/testing/buildCli.ts`, `src/integration/testing/setUpReviewRepository.ts`
- Modify: `vitest.config.mts` (an `integration` project), `tsconfig.server.json` (include `src/integration`), `AGENTS.md`, `.github/workflows/ci.yml` (build step)
- Test: `src/integration/agentLoop.integration.test.ts`, `src/integration/serverLifecycle.integration.test.ts`

**Interfaces:**
- Consumes: the built `dist/cli.js` from Task 11 and the browser API from Tasks 5 and 6.
- Produces:
  - A Vitest `integration` project. Its `globalSetup` builds `dist/cli.js` with Vite's `build` API, and `pnpm test` runs it.
  - `setUpReviewRepository(): () => ReviewRepository`, which registers per-test hooks. Each test gets a temp git repo with `docs/plan.md`, and the hooks stop its server afterwards. `ReviewRepository` has `browser`, `readServerFile`, `run`, `start` and `writeDocument`.

These tests cover behaviour Tasks 1 to 11 built, so they pass on their first run. Step 4 instead checks that they can fail.

- [ ] **Step 1: Add the integration project**

Replace `vitest.config.mts` with:

````ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/**/*.d.ts"],
      include: ["src/**/*.{ts,tsx}"],
      // fallow reads coverage/coverage-final.json without being asked, which would make commit checks depend on a stale
      // local report, so the json report goes under another name and `fallow health --coverage` is pointed at it
      reporter: ["text-summary", ["json", { file: "istanbul.json" }]],
    },
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          env: { TZ: "UTC" },
          environment: "node",
          include: ["src/cli/**/*.test.ts", "src/server/**/*.test.ts", "src/shared/**/*.test.ts"],
          name: "node",
        },
      },
      {
        extends: true,
        test: {
          env: { TZ: "UTC" },
          environment: "node",
          globalSetup: ["src/integration/testing/buildCli.ts"],
          include: ["src/integration/**/*.test.ts"],
          name: "integration",
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          env: { TZ: "UTC" },
          environment: "jsdom",
          include: ["src/web/**/*.test.{ts,tsx}"],
          name: "web",
        },
      },
    ],
  },
});
````

Replace `tsconfig.server.json` with:

````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.server.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true
  },
  "include": ["src/cli", "src/integration", "src/server", "src/shared"]
}
````

`src/integration/testing/buildCli.ts`:

````ts
import { fileURLToPath } from "node:url";

import { build } from "vite";

/**
 * Builds `dist/cli.js` once before the integration tests, which run it as the agent would
 */
export default async function buildCli(): Promise<void> {
  await build({ configFile: fileURLToPath(new URL("../../../vite.config.mts", import.meta.url)), logLevel: "warn" });
}
````

`src/integration/testing/setUpReviewRepository.ts`:

````ts
import type { ChildProcess } from "node:child_process";
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterEach, beforeEach } from "vitest";

import type { ServerFile } from "../../server/runtime/serverFileSchema";
import { serverFileSchema } from "../../server/runtime/serverFileSchema";

const runCommand = promisify(execFile);

const cliPath = fileURLToPath(new URL("../../../dist/cli.js", import.meta.url));

export const plan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

export interface CliResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

export interface RunningCli {
  child: ChildProcess;
  result: Promise<CliResult>;

  /**
   * Resolves once the command has written `text` to standard error
   */
  printedToStderr(text: string): Promise<void>;
}

export interface ReviewRepository {
  root: string;

  /**
   * Sends a request the way the review page in the browser would
   */
  browser(method: string, url: string, body?: unknown): Promise<Response>;

  readServerFile(): Promise<ServerFile>;
  run(args: string[], input?: string): Promise<CliResult>;
  start(args: string[]): RunningCli;
  writeDocument(document: string, source: string): Promise<void>;
}

/**
 * Registers hooks that give each test a fresh git repository holding `docs/plan.md`, and stop its review server and
 * delete it afterwards
 *
 * @returns a function that returns the running test's repository
 */
export function setUpReviewRepository(): () => ReviewRepository {
  let repository: ReviewRepository | undefined;
  let directory = "";

  beforeEach(async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), "markdown-review-integration-"));
    const root = await realpath(directory);
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs", "plan.md"), plan);
    await runCommand("git", ["init", "-q"], { cwd: root });
    repository = createRepository(root);
  });

  afterEach(async () => {
    if (repository !== undefined) {
      await stopServer(repository);
    }
    await rm(directory, { force: true, recursive: true });
  });

  return () => {
    if (repository === undefined) {
      throw new TypeError("The repository is only available inside a test");
    }
    return repository;
  };
}

function createRepository(root: string): ReviewRepository {
  const readServerFile = async (): Promise<ServerFile> =>
    serverFileSchema.parse(JSON.parse(await readFile(path.join(root, ".markdown-review", "server.json"), "utf8")));
  const start = (args: string[], input?: string): RunningCli => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: root,
      env: { ...process.env, MARKDOWN_REVIEW_NO_BROWSER: "1" },
    });
    let stdout = "";
    let stderr = "";
    const stderrWaiters: { resolve: () => void; text: string }[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
      for (const waiter of stderrWaiters.filter(({ text }) => stderr.includes(text))) {
        waiter.resolve();
      }
    });
    child.stdin.end(input ?? "");
    const result = new Promise<CliResult>((resolve) => {
      child.on("close", (exitCode) => resolve({ exitCode, stderr, stdout }));
    });
    const printedToStderr = (text: string): Promise<void> =>
      new Promise((resolve) => {
        if (stderr.includes(text)) {
          resolve();
          return;
        }
        stderrWaiters.push({ resolve, text });
      });
    return { child, printedToStderr, result };
  };
  return {
    browser: async (method, url, body) => {
      const { port } = await readServerFile();
      const origin = `http://127.0.0.1:${port}`;
      return fetch(`${origin}${url}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: { "content-type": "application/json", origin },
        method,
      });
    },
    readServerFile,
    root,
    run: (args, input) => start(args, input).result,
    start: (args) => start(args),
    writeDocument: (document, source) => writeFile(path.join(root, ...document.split("/")), source),
  };
}

async function stopServer(repository: ReviewRepository): Promise<void> {
  await repository.run(["stop"]);
  const recorded = await repository.readServerFile().catch(() => null);
  if (recorded !== null && recorded.pid !== process.pid) {
    try {
      process.kill(recorded.pid);
    } catch {
      return;
    }
  }
}
````

- [ ] **Step 2: Write the integration tests**

`src/integration/agentLoop.integration.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { plan, setUpReviewRepository } from "./testing/setUpReviewRepository";

const getRepository = setUpReviewRepository();

const cacheComment = {
  anchor: {
    document: "docs/plan.md",
    endOffset: 29,
    kind: "passage",
    prefix: "Plan\nWe ",
    quote: "cache results for 24h",
    startOffset: 8,
    suffix: ".\nRetries happen three times.",
  },
  body: "Why 24h?",
};

describe("agent loop", () => {
  test("must hand the user's comment to a waiting poll when the user submits", async () => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);
    const poll = repository.start(["poll", "--timeout", "20"]);
    await poll.printedToStderr("Waiting up to 20s");

    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "request-changes" });

    const { exitCode, stdout } = await poll.result;
    expect(exitCode).toBe(0);
    expect(stdout).toContain('#1 docs/plan.md:3\n  quote: "cache results for 24h"\n  user: Why 24h?');
  });

  test("must say there are no comments yet and exit cleanly when the poll times out", async () => {
    const repository = getRepository();

    const { exitCode, stdout } = await repository.run(["poll", "--timeout", "1"]);

    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^No comments yet\.\n\nnext_step: Run `markdown-review poll` again/);
  });

  test("must return the same threads when the poll is run again before the agent acts", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "request-changes" });

    const first = await repository.run(["poll", "--timeout", "5"]);
    const second = await repository.run(["poll", "--timeout", "5"]);

    expect(second.stdout).toBe(first.stdout);
    expect(first.stdout).toContain("1 thread needs you (docs/plan.md: 1)");
  });

  test("must tell the agent to run poll again when the poll is killed while waiting", async () => {
    const repository = getRepository();
    const poll = repository.start(["poll", "--timeout", "20"]);
    await poll.printedToStderr("Waiting up to 20s");

    poll.child.kill("SIGTERM");

    const { exitCode, stderr } = await poll.result;
    expect(exitCode).toBe(143);
    expect(stderr).toContain("Nothing was lost; run `markdown-review poll` again");
  });

  test("must end the poll when the user approves, and start a new round on the next open", async () => {
    const repository = getRepository();
    await repository.run(["open", "docs/plan.md"]);
    const poll = repository.start(["poll", "--timeout", "20"]);
    await poll.printedToStderr("Waiting up to 20s");

    await repository.browser("POST", "/api/submit", { verdict: "approve" });
    const approved = await poll.result;
    await repository.run(["open", "docs/plan.md"]);
    const nextRound = await repository.run(["inbox"]);

    expect(approved.stdout).toMatch(/^Review approved\. No threads need you\./);
    expect(nextRound.stdout).toMatch(/^No threads need you\./);
  });

  test("must say what is left after each reply and resolve", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });
    await repository.browser("POST", "/api/submit", { verdict: "request-changes" });

    const replied = await repository.run(["reply", "1", "Upstream", "is", "daily."]);
    const resolved = await repository.run(["resolve", "2", "--file", "-"], "Checked every section.\nAll consistent.");

    expect(replied.stdout).toContain("Replied to #1; it waits for the user.\n1 thread still needs you: #2.");
    expect(resolved.stdout).toContain("Resolved #2. No threads need you now.");
  });

  test("must name the threads that need the agent when it acts on a thread that does not", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "request-changes" });

    const { exitCode, stderr } = await repository.run(["resolve", "99"]);

    expect(exitCode).toBe(1);
    expect(stderr).toBe(
      "error: No thread #99 is waiting for you. The threads that need you are #1.\n\nnext_step: Run `markdown-review inbox` to see them.\n"
    );
  });

  test("must report the moved lines when the doc was edited while the server was stopped", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    await repository.browser("POST", "/api/threads", cacheComment);
    await repository.browser("POST", "/api/submit", { verdict: "request-changes" });
    await repository.run(["stop"]);

    await repository.writeDocument("docs/plan.md", plan.replace("# Plan\n\n", "# Plan\n\nIntro.\n\n"));
    const { stdout } = await repository.run(["inbox"]);

    expect(stdout).toContain("#1 docs/plan.md:5\n");
  });
});
````

`src/integration/serverLifecycle.integration.test.ts`:

````ts
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { createServer } from "node:http";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpReviewRepository } from "./testing/setUpReviewRepository";

const getRepository = setUpReviewRepository();

describe("server lifecycle", () => {
  test("must start exactly one server when several commands run at once", async () => {
    const repository = getRepository();

    const results = await Promise.all([1, 2, 3, 4].map(() => repository.run(["inbox"])));

    expect(results.map(({ exitCode }) => exitCode)).toEqual([0, 0, 0, 0]);
    expect(await countServerStarts(repository.root)).toBe(1);
  });

  test("must keep using the root's server when the next command runs", async () => {
    const repository = getRepository();
    await repository.run(["inbox"]);
    const first = await repository.readServerFile();

    await repository.run(["inbox"]);

    expect((await repository.readServerFile()).pid).toBe(first.pid);
    expect(await countServerStarts(repository.root)).toBe(1);
  });

  test("must start a new server when server.json names one that no longer answers", async () => {
    const repository = getRepository();
    const gone = await listen(createServer());
    await new Promise((resolve) => gone.server.close(resolve));
    await writeServerFile(repository.root, { port: gone.port, protocol: 1 });

    const { exitCode } = await repository.run(["inbox"]);

    expect(exitCode).toBe(0);
    expect((await repository.readServerFile()).port).not.toBe(gone.port);
  });

  test("must shut down a server of an older protocol and start the current one", async () => {
    const repository = getRepository();
    const older = await startFakeServer(repository.root, 0);

    const { exitCode } = await repository.run(["inbox"]);

    expect(exitCode).toBe(0);
    expect(older.shutdownRequested()).toBe(true);
    expect((await repository.readServerFile()).protocol).toBe(1);
  });

  test("must leave a server of a newer protocol running and say how to use it", async () => {
    const repository = getRepository();
    const newer = await startFakeServer(repository.root, 2);

    const { exitCode, stderr } = await repository.run(["inbox"]);
    await newer.close();

    expect(exitCode).toBe(1);
    expect(stderr).toContain("A newer markdown-review (version 9.9.9, protocol 2) is serving");
    expect(stderr).toContain("next_step: Run the newer markdown-review");
    expect(newer.shutdownRequested()).toBe(false);
  });

  test("must stop the server and remove server.json when the agent runs stop", async () => {
    const repository = getRepository();
    await repository.run(["open"]);
    const { port } = await repository.readServerFile();

    const { stdout } = await repository.run(["stop"]);

    expect(stdout).toBe(
      `Stopped the review server for ${repository.root}.\n\nnext_step: None; any markdown-review command starts it again.\n`
    );
    await expect(stat(path.join(repository.root, ".markdown-review", "server.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fetch(`http://127.0.0.1:${port}/api/health`)).rejects.toThrow();
  });
});

async function countServerStarts(root: string): Promise<number> {
  const log = await readFile(path.join(root, ".markdown-review", "server.log"), "utf8");
  return log.split("\n").filter((line) => line.includes(" info Serving ")).length;
}

function listen(server: Server): Promise<{ port: number; server: Server }> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ port: typeof address === "object" && address !== null ? address.port : 0, server });
    });
  });
}

async function writeServerFile(root: string, { port, protocol }: { port: number; protocol: number }): Promise<void> {
  const serverFile = {
    pid: 999_999,
    port,
    protocol,
    root,
    startedAt: new Date().toISOString(),
    token: "b".repeat(64),
    version: "9.9.9",
  };
  await mkdir(path.join(root, ".markdown-review"), { recursive: true });
  await writeFile(path.join(root, ".markdown-review", "server.json"), JSON.stringify(serverFile));
}

/**
 * Starts a stand-in for another version's server, recorded in the root's server.json
 */
async function startFakeServer(root: string, protocol: number) {
  let shutdownRequested = false;
  const fake = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.url === "/api/health") {
      response.end(JSON.stringify({ name: "markdown-review", pid: 999_999, protocol, root, version: "9.9.9" }));
      return;
    }
    if (request.url === "/api/shutdown") {
      shutdownRequested = true;
      response.end(JSON.stringify({ stopping: true }), () => {
        fake.close();
        fake.closeAllConnections();
      });
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: { message: "Not found", reason: "not-found" } }));
  });
  const { port } = await listen(fake);
  await writeServerFile(root, { port, protocol });
  return {
    close: () =>
      new Promise<void>((resolve) => {
        fake.close(() => resolve());
        fake.closeAllConnections();
      }),
    shutdownRequested: () => shutdownRequested,
  };
}
````

- [ ] **Step 3: Run the integration tests**

Run: `pnpm test --project integration`
Expected: 14 tests pass in about 6 seconds. Afterwards, `ps -axo command | grep "dist/cli.js serve" | grep -v grep` prints nothing, because every test stops its server.

- [ ] **Step 4: Check the tests can fail**

Temporarily change `Resolved #${thread.id}.` to `Closed #${thread.id}.` in `src/cli/formatAgentAction.ts`, and run `pnpm test --project integration`. Expected: "must say what is left after each reply and resolve" fails, because the global setup rebuilt `dist/cli.js` with the change. Restore the line, and run `pnpm test --project integration` again: all 14 pass.

- [ ] **Step 5: Document the commands and build in CI**

Replace `AGENTS.md` with:

````markdown
# AGENTS.md

Markdown Review: a local tool for reviewing agent-written markdown in a browser and handing the comments back to the coding agent through a CLI. The design is `docs/superpowers/specs/2026-10-08-markdown-review-design.md`; the build plans are in `docs/superpowers/plans/`.

## Commands

- `pnpm build`: build the CLI and server into `dist/cli.js`
- `pnpm test`: all tests: the `node` project (`src/cli`, `src/server`, `src/shared`), the `web` project in jsdom (`src/web`), and the `integration` project, which builds `dist/cli.js` first and runs it as separate processes against temporary git repositories
- `pnpm test:coverage`: tests with v8 coverage, written to `coverage/istanbul.json`
- `pnpm verify`: lint, format check, typecheck and tests
- Try the agent loop by hand: `pnpm build`, then in any git repository run `node <this repo>/dist/cli.js open <doc.md>`, `inbox`, `poll`, `reply`, `resolve` and `stop`. Set `MARKDOWN_REVIEW_NO_BROWSER=1` to keep `open` from launching a browser.

## Layout

- `src/shared/`: code the server and the browser both run: the markdown-it configuration, blocks and canonical text, and the zod schemas of the review model. No Node or DOM APIs.
- `src/server/`: the anchorer and the review store; `http/` holds the Hono app (agent routes, browser routes, poll, event stream, repo files, app shell) and `runtime/` runs it as the per-repo server process.
- `src/cli/`: the agent's CLI. `main.ts` is the bin entry; the CLI starts the server by running itself as `serve --root <root>`, detached.
- `src/integration/`: tests that drive the built CLI the way an agent does.
- `src/web/`: browser code: the walk that reads canonical text from rendered blocks, and the conformance test that checks it against `src/shared`.

## Protocol

`protocolVersion` in `src/shared/api/protocolVersion.ts` versions the HTTP API and the store format together. Bump it for any change an older CLI or server could not handle: the CLI replaces a server of an older protocol and refuses to touch one of a newer protocol.

## Anchoring

Comments anchor to offsets in a doc's canonical text, which `parseBlocks` computes from markdown-it tokens and the browser reads back from the rendered page with `layOutBlockText`. The two must agree exactly: run the `web` project's conformance test after any change to `createMarkdownIt`, the markdown plugins, Shiki or DOMPurify, and add a case to `src/web/rendering/testing/conformanceCorpus.md` for any new kind of content.

Install dependencies with `pnpm add` and no hand-written version, then run `pnpm format`, which sorts `package.json`.

## Fallow

fallow is a devDependency; run it as `pnpm exec fallow`. Its skill is `node_modules/fallow/skills/fallow/SKILL.md`.

- The husky pre-commit hook runs `fallow audit` on every commit after the first. A `fail` verdict blocks the commit: fix the findings it reports. Only findings the commit introduces count, so every new export must be used by code or tests in the same commit.
- The commit check estimates test coverage from which tests import a function. For exact CRAP scores run `pnpm test:coverage`, then `pnpm exec fallow health --coverage coverage/istanbul.json`.
- To refresh the skill pointers and MCP config after upgrading fallow, run `pnpm exec fallow agent install --harness claude --harness codex --without guide --without hooks`.
````

Replace `.github/workflows/ci.yml` with:

````yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
````

- [ ] **Step 6: Run everything**

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: `pnpm verify` is clean with 356 tests; fallow reports no issues.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Drive the built CLI end to end"
```

---

## After the last task

- [ ] Run `pnpm verify` and `pnpm exec fallow audit`. Expected: clean, 356 tests.
- [ ] Use superpowers:finishing-a-development-branch. Nothing is pushed yet; ask the user before pushing to `Krelborn/markdown-review`.
