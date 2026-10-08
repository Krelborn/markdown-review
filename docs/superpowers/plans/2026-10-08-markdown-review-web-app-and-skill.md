# Markdown Review Web App and Skill Implementation Plan (plan 3 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the browser app where the user reads a doc, comments on it and submits, serve it from the review server, teach agents the review loop with a skill and `install-skill`, and test the whole loop end to end in real browsers.

**Architecture:** `src/web/` is a React 19 app that Vite builds from `src/web/index.html` into `dist/web/`, which the server's shell routes now serve under plan 2's Content Security Policy. The app renders a doc with the shared markdown-it configuration, Shiki (its JavaScript regex engine, because the policy forbids WebAssembly) and Mermaid. It maps DOM positions to canonical-text offsets and back with plan 1's `layOutBlockText`, and highlights threads with the CSS Custom Highlight API. It reaches the server through a `ReviewApi`: `fetch` for the browser routes and an `EventSource` for `/api/events`. Component tests replace that API with an in-memory fake. The CLI gains `install-skill`, which writes `skills/markdown-review/SKILL.md`; Vite bundles that file into `dist/cli.js`. Playwright drives the built package in Chromium and WebKit, with the CLI playing the agent.

**Tech Stack:** React 19.3 with the React Compiler (`babel-plugin-react-compiler` through `@rolldown/plugin-babel`), `@krelborn/stylesui` 0.2.1, Vite 8, Shiki 4 (`shiki/core` with `shiki/engine/javascript`), Mermaid 12, DOMPurify 3, zod 4, Vitest 5 with jsdom and Testing Library, Playwright 1.64, oxlint, oxfmt, fallow.

**Spec:** `docs/superpowers/specs/2026-10-08-markdown-review-design.md`. This plan implements:
- the `web` unit: sections 5, 10 and 11, and the browser side of section 7;
- `SKILL.md` and `install-skill` (section 8);
- the component and end-to-end tests (section 14);
- the packaging of the web app (section 15) and the rest of section 16's CI.

It builds on plans 1 and 2 on `main`. It also takes three hand-offs from plan 2's final review:
- the event stream refuses requests from other sites;
- a tab stays on its own origin when the agent opens a doc;
- the package builds before it is published.

## Global Constraints

- Everything in plans 1 and 2's Global Constraints still holds:
  - macOS and Linux;
  - Node `^22.22.2 || ^24.15.0 || >=26.0.0`;
  - pnpm 10.18.3, with `pnpm add` and no hand-written version, then `pnpm format`;
  - oxlint and oxfmt, no ESLint;
  - TypeScript strict with `noUncheckedIndexedAccess`;
  - full words in identifiers, and type imports before value imports.
- The `coding-standards` plugin's standards are authoritative over this plan's code. The code was written to them, including the React standard:
  - props sorted alphabetically, then `aria-*`, then `data-*`;
  - explicit boolean values;
  - `clsx` for conditional classes;
  - one folder per component.
- `@krelborn/stylesui` comes from GitHub Packages. `.npmrc` maps `@krelborn` to `https://npm.pkg.github.com` and reads its token from `GITHUB_TOKEN`, which needs `read:packages`; `GITHUB_TOKEN=$(gh auth token)` works. StylesUI, React and every other package only the browser uses are devDependencies, because Vite bundles them into `dist/web/` (spec section 15).
- The app shell keeps plan 2's Content Security Policy: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`.
  - Nothing in the app may need `eval`, an inline script or WebAssembly.
  - The end-to-end fixture fails a test on any console error, which is how a violation shows.
- Supported browsers are current Chrome, Firefox and Safari. The CSS Custom Highlight API sets the floor: Chrome 105, Firefox 140, Safari 17.2.
- jsdom lacks several APIs the app uses, so `src/web/testing/` holds stand-ins for them and the end-to-end tests cover the real thing. The missing APIs are:
  - the Highlight API and the Popover API;
  - `ResizeObserver` and range geometry;
  - scrolling.
- The browser sends every change as `Content-Type: application/json` from the page's own origin, which plan 2's middleware requires. The browser never sees the agent token.
- Highlights are registered as `markdown-review-threads` and `markdown-review-selected`. Elements the app adds over the document view carry `data-md-ignore`.
- Component tests mock only at the network boundary. Components take the API from `ReviewApiContext`, and tests pass `createFakeReviewApi()`: an in-memory server whose methods are spies.
- Every commit passes the pre-commit hook, including `fallow audit`. Three fallow behaviours shape this plan:
  - Any new export that nothing in the same commit uses blocks the commit.
  - A function over fallow's complexity limits blocks it too. fallow counts each hook a component calls towards its cognitive score, so the bigger components hand work to small hooks and child components.
  - fallow warns, without blocking, that StylesUI, React and the other browser packages are devDependencies used in production code. That is intended.
- Vitest's `web` project reports a missing module as `Failed to resolve import "./X" from "…". Does the file exist?`. That is the expected failure wherever a step's test imports a module the task has not written yet.

## Review Focus

These inputs are implied by the spec but easy to miss. Each has a test in the task that owns the code.

1. **The user is halfway through a reply when the agent edits the doc and answers.** Spec section 10 says a re-render keeps unsent draft text. Pinned by "must keep the user's unsent reply when the agent edits the doc and answers" in `App.test.tsx` (Task 10).
2. **The user follows a link to a heading, reads on, and the agent edits the doc.** The page must stay where the user is, not jump back to the heading. Pinned by "must scroll to the heading the address names once, and keep the user's place when the doc changes" in `DocumentView.test.tsx` (Task 9).
3. **Doc and file names with spaces or non-ASCII characters**, in the address `open` prints and in a doc's links. Pinned by:
   - "must show a doc whose name has spaces and accents when the page opens at its address" (Task 10);
   - the link and image cases in `renderDocument.test.ts` (Task 4).
4. **The browser's back button** after the user follows a link or the agent opens another doc. The previous doc should come back. Pinned by "must show the doc the user came from when the user goes back" (Task 10).
5. **An empty doc, and a selection outside the doc**, such as text in the sidebar. An empty doc must still take a whole-doc comment, and selecting sidebar text must not offer Comment. Pinned by "must still offer a comment on the whole doc when the doc is empty" and "must stop offering Comment when the user selects text outside the doc" (Task 9).

## Notes for the implementer

- **How this plan was checked.** Every file in this plan was written and run in a scratch clone of the repository on 2026-10-08. It was then replayed task by task from `main` (7a78ecc), with each task committed through the real pre-commit hook, and the replay ends byte-identical to the scratch result.
  - `pnpm verify` and the fallow gate passed at every commit.
  - The suite grows from plan 2's 367 tests to 491.
  - The Playwright suite runs 5 scenarios in each of 2 browsers.
  - Still run each failing test before its implementation exists, and check it fails for the stated reason.
- **Before you start.**
  - Work on a branch (for example `web-app`), not on `main`.
  - Check that `gh auth status` lists the `read:packages` scope.
  - Export `GITHUB_TOKEN=$(gh auth token)` in the shell you run pnpm from. Without it pnpm cannot install StylesUI, and every pnpm command warns that it could not replace `${GITHUB_TOKEN}`.
- **Files that change across tasks.** Each task gives the whole file as it should be after that task, or, for a long file with a small change, the change as a diff. The exceptions are `package.json` and `pnpm-lock.yaml`, which `pnpm add` and the listed script edits produce.
  - `src/web/testing/setup.ts`: Tasks 1, 6, 8 and 9.
  - `src/web/testing/standInForLayout.ts`: Tasks 6, 9 and 10.
  - `src/web/main.tsx`: Tasks 1, 4 and 10.
  - `src/web/components/App/App.tsx` and `App.test.tsx`: Tasks 1 and 10.
  - `src/server/http/createApp.ts`: Tasks 1 and 2.
  - `src/cli/runCli.test.ts`: Tasks 1 and 11.
  - `AGENTS.md`: Tasks 1, 11 and 12.
  - `.github/workflows/ci.yml`: Tasks 1 and 12.
  - `package.json`: Tasks 1, 4, 6 and 12.
- **Decisions this plan makes where the spec is silent or loose.** They are recorded so a reviewer can weigh them.
  - **Shiki's JavaScript engine.** Shiki's default Oniguruma engine compiles WebAssembly, which `script-src 'self'` blocks, so the app uses the JavaScript engine instead.
    - Every bundled grammar ships, each in its own chunk, loaded only when a doc uses that language.
    - `dist/web/` comes to about 15 MB across about 400 files, and the page's entry chunk is about 690 kB.
  - **Light and dark code.** Shiki renders both GitHub themes, and `src/web/global.css` switches to the dark one under `prefers-color-scheme: dark`, matching StylesUI's `system` mode. Mermaid picks its theme the same way when it draws.
  - **"Comment on this doc"** sits above the rendered doc rather than under its first heading. That way it needs no element inside the doc's HTML, and it works for a doc with no heading.
  - **Gutter controls.** Thread markers sit in the gutter to the right of the doc, side by side when they share a line; the "+" for a block is on the left.
  - **What is highlighted.** Draft and open passages are highlighted, and so is the selected thread even when it is resolved; outdated passages are not. A click on highlighted text selects the shortest passage under it.
  - **The "new" marker.** A thread is new while it has an agent message the user has not viewed, and selecting the thread marks it viewed. The counts are kept in `localStorage`, so they are per server origin.
  - **Remote images** stay blocked by `img-src 'self' data:`; a doc's own images come from `/files/`.
  - **Routing.** The app routes itself, between `/` and `/document/<path>`, with `history.pushState`.
    - A `navigate` event keeps only the path and fragment of the URL the server sends, so a tab opened on `localhost` stays on `localhost`. This settles plan 2's ruling.
  - **Requests from other sites.** Every route now refuses a request whose `Origin` names another site, so a page elsewhere cannot connect to `/api/events` and catch the agent's `navigate`. This settles plan 2's ruling.
    - Same-origin GETs carry no `Origin` header, so they are unaffected.
  - **The skill** is bundled into `dist/cli.js` with Vite's `?raw` import, so `install-skill` reads no file at run time. `--global` writes under `$HOME`.
  - **End-to-end browsers.** The end-to-end tests run in Chromium and WebKit.
    - Playwright's Firefox 157 build would not launch on the machine this plan was written on (macOS 27, "Could not find profile folder"), even outside the test suite.
    - Firefox is left out until it launches. The app uses nothing Firefox 140 lacks.
  - **`prepublishOnly`** runs `pnpm build`, so publishing cannot ship a package without `dist/`. This settles plan 2's ruling.
- **CI access to StylesUI.** The CI job needs `packages: read` and `GITHUB_TOKEN` to install StylesUI. GitHub grants that only if the `@krelborn/stylesui` package lets this repository read it (in the package's settings, "Manage Actions access"). Changing that setting is the user's call, and no task does it.

## File Structure

```
.npmrc                               maps @krelborn to GitHub Packages for StylesUI
vite.web.config.mts                  builds src/web into dist/web with the React Compiler
playwright.config.ts, tsconfig.e2e.json
skills/markdown-review/SKILL.md      the agent skill; bundled into dist/cli.js
src/server/http/
  shellRoutes.ts                     serves dist/web's index.html and assets
  securityMiddleware.ts              adds refuseOtherOrigins
src/cli/commands/installSkillCommand.ts, src/cli/rawMarkdownImports.d.ts
src/web/
  index.html, main.tsx, global.css   the page Vite builds, and its entry
  api/                               ReviewApi, createReviewApi (fetch and EventSource), ReviewApiContext, useReviewApi,
                                     useReviewEvents, reviewEventSchema, ReviewApiError, describeFailure
  rendering/                         renderDocument and its steps: loadHighlight, findFenceLanguages, addHeadingIds,
                                     pointLinksAtReview, renderMermaidDiagrams (plan 1's layOutBlockText stays here)
  anchoring/                         DOM point <-> canonical offset: offsetInDocument, rangeForPassage, selectedPassage,
                                     passageAnchor, blockPassage, offsetAtPoint, blockElementAt, PagePoint
  navigation/                        documentPagePath, documentPathOf, isPlainLeftClick, usePageLocation
  review/                            client rules and data hooks: groupThreads, countDrafts, describeLocation,
                                     isHighlighted, threadAtOffset, useSeenMessages, useThreads, useDocumentSource,
                                     NewComment
  components/                        one folder per component:
    App/ (with DocumentPane), TopBar/, AgentStatus/, SubmitMenu/, DocumentsMenu/, DocumentLinks/, DocumentsPage/,
    DocumentView/ (with DocumentControls and its hooks), ThreadSidebar/ (with ThreadGroup, ThreadList,
    NewCommentForm), ThreadCard/ (with ThreadActions), CommentForm/, Quote/
  testing/                           setup.ts, createFakeReviewApi, mountDocument, and the jsdom stand-ins
src/integration/testing/             createGitRepository, startCli, stopReviewServer (shared with the e2e tests)
src/e2e/                             review.e2e.ts and its fixture
```

---

### Task 1: Build the web app and serve it from the review server

**Files:**
- Create: `.npmrc`, `vite.web.config.mts`, `src/web/index.html`, `src/web/main.tsx`, `src/web/components/App/App.tsx`, `src/web/testing/setup.ts`
- Modify: `package.json`, `vitest.config.mts`, `tsconfig.node.json`, `.fallowrc.json`, `.github/workflows/ci.yml`, `AGENTS.md`, `src/server/http/AppDependencies.ts`, `src/server/http/contentTypeFor.ts`, `src/server/http/createApp.ts`, `src/server/http/shellRoutes.ts`, `src/server/runtime/runServer.ts`, `src/cli/commands/serveCommand.ts`, `src/server/http/testing/setUpAppTest.ts`
- Test: `src/web/components/App/App.test.tsx`, `src/server/http/shellRoutes.test.ts`, `src/server/runtime/runServer.test.ts`, `src/cli/connectToServer.test.ts`, `src/cli/runCli.test.ts`, `src/cli/ServerClient.test.ts`

**Interfaces:**
- Consumes:
  - `createApp(dependencies: AppDependencies): Hono` and `runServer(options: RunServerOptions): Promise<RunningServer>` (plan 2).
  - `CliContext.cliPath`, the built CLI's own path, which the `serve` command now uses to find `dist/web/`.
  - `readTextFileOrNull`, `isFileNotFound` (plan 1); `isRepositoryRelativePath` (plan 1); `contentTypeFor`, `HttpError` and `setUpAppTest` (plan 2).
- Produces:
  - `AppDependencies.webDirectory: string` and `RunServerOptions.webDirectory: string`, the built web app. `serve` passes `<directory of dist/cli.js>/web`.
  - `GET /` and `GET /document/*` serve `<webDirectory>/index.html` with the Content Security Policy, or answer 500 `missing-web-app`. `GET /assets/*` serves `<webDirectory>/assets/<name>` with its type and `X-Content-Type-Options: nosniff`, or answers 404 `missing-file`.
  - `setUpAppTest` also exports `testShellHtml` and `testAppScript`, writes them as a built web app beside the repo, and returns its `webDirectory`.
  - `pnpm build` builds `dist/cli.js`, then `dist/web/` with `vite.web.config.mts`. `src/web/main.tsx` mounts `App` from `src/web/components/App/App.tsx`, a placeholder until Task 10.
  - `src/web/testing/setup.ts`, the `web` project's setup file, which later tasks extend.

- [ ] **Step 1: Create the branch**

```bash
git switch -c web-app
```

- [ ] **Step 2: Map the `@krelborn` scope to GitHub Packages and install the browser toolchain**

`.npmrc`:

````ini
@krelborn:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
````

```bash
export GITHUB_TOKEN=$(gh auth token)
pnpm add -D react react-dom @types/react @types/react-dom @krelborn/stylesui @vitejs/plugin-react @rolldown/plugin-babel @babel/core babel-plugin-react-compiler @testing-library/react @testing-library/dom @testing-library/jest-dom
pnpm format
```

Expected: `@krelborn/stylesui` resolves to 0.2.1 from GitHub Packages. `@babel/core` is `@rolldown/plugin-babel`'s peer and `@testing-library/dom` is `@testing-library/react`'s; neither is imported directly.

- [ ] **Step 3: Write the failing tests**

The `web` project gains the React plugin and a setup file. Testing Library cleans up after each test only when Vitest's globals are on, and they are off, so the setup file does it.

`vitest.config.mts`:

````ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
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
          // StylesUI's modules import their own CSS, which Node cannot load, so Vite must transform them
          server: { deps: { inline: [/@krelborn\/stylesui/] } },
          setupFiles: ["src/web/testing/setup.ts"],
        },
      },
    ],
  },
});
````

`src/web/testing/setup.ts`:

````ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Testing Library only cleans up automatically when Vitest globals are on
afterEach(() => {
  cleanup();
});
````

`src/web/components/App/App.test.tsx`:

````tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { App } from "./App";

describe("App", () => {
  test("must name the tool when the page opens", () => {
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Markdown Review" })).toBeInTheDocument();
  });
});
````

`setUpAppTest` now builds a web app beside the repo, so the shell routes can be tested against known files:

`src/server/http/testing/setUpAppTest.ts`:

````ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { BrowserTabs } from "../../events/BrowserTabs";
import type { ServerEvent } from "../../events/ServerEvents";
import { ServerEvents } from "../../events/ServerEvents";
import type { LogEntry } from "../../logging/testing/createMemoryLogger";
import { createMemoryLogger } from "../../logging/testing/createMemoryLogger";
import { ActivityMonitor } from "../../runtime/ActivityMonitor";
import { ReviewStore } from "../../store/ReviewStore";
import { createApp } from "../createApp";
import { RecentDocuments } from "../RecentDocuments";

export const testPort = 4321;

export const testToken = "a".repeat(64);

export const testPlan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

export const testShellHtml =
  '<!doctype html><title>Markdown Review</title><script type="module" src="/assets/app.js"></script>\n';

export const testAppScript = 'document.title = "Markdown Review";\n';

/**
 * The app over a fresh repo, with helpers that send requests and what the tests inspect
 */
interface AppTest {
  activity: ActivityMonitor;

  /**
   * Sends a request the way the CLI does: with the agent token and no `Origin`
   */
  agent: (method: string, url: string, body?: unknown) => Promise<Response>;

  /**
   * Sends a request the way the browser does: with the server's `Origin` and a JSON content type
   */
  browser: (method: string, url: string, body?: unknown) => Promise<Response>;

  entries: LogEntry[];
  idleCount: () => number;
  published: ServerEvent[];
  recentDocuments: RecentDocuments;
  request: (method: string, url: string, headers: Record<string, string>, body?: unknown) => Promise<Response>;
  root: string;
  shutdownCount: () => number;
  store: ReviewStore;
  tabs: BrowserTabs;
  watched: string[];
  webDirectory: string;
}

interface AppTestOptions {
  /**
   * How long the activity monitor waits before it counts the app as idle; an hour unless a test needs to see it
   */
  idleMilliseconds?: number;
}

/**
 * Builds the app over a fresh repo in `directory`, holding `docs/plan.md`, and a built web app holding
 * `assets/app.js`, with helpers that send requests the way the CLI and the browser do
 */
export async function setUpAppTest(
  directory: string,
  { idleMilliseconds = 60 * 60_000 }: AppTestOptions = {}
): Promise<AppTest> {
  const root = path.join(directory, "repo");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "plan.md"), testPlan);
  const webDirectory = path.join(directory, "web");
  await mkdir(path.join(webDirectory, "assets"), { recursive: true });
  await writeFile(path.join(webDirectory, "index.html"), testShellHtml);
  await writeFile(path.join(webDirectory, "assets", "app.js"), testAppScript);
  const { entries, logger } = createMemoryLogger();
  const store = new ReviewStore(root, logger);
  await store.initialize();
  const events = new ServerEvents();
  const published: ServerEvent[] = [];
  events.subscribe((event) => published.push(event));
  const tabs = new BrowserTabs();
  let idles = 0;
  const activity = new ActivityMonitor({
    events,
    idleMilliseconds,
    onIdle: () => {
      idles += 1;
    },
  });
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
    webDirectory,
  });
  const request = async (method: string, url: string, headers: Record<string, string>, body?: unknown) =>
    app.request(`http://127.0.0.1:${testPort}${url}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { host: `127.0.0.1:${testPort}`, ...headers },
      method,
    });
  const browser = async (method: string, url: string, body?: unknown) =>
    request(method, url, { "content-type": "application/json", origin: `http://127.0.0.1:${testPort}` }, body);
  const agent = async (method: string, url: string, body?: unknown) =>
    request(method, url, { authorization: `Bearer ${testToken}`, "content-type": "application/json" }, body);
  return {
    activity,
    agent,
    browser,
    entries,
    idleCount: () => idles,
    published,
    recentDocuments,
    request,
    root,
    shutdownCount: () => shutdowns,
    store,
    tabs,
    watched,
    webDirectory,
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

`src/server/http/shellRoutes.test.ts`:

````ts
import { rm } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { setUpAppTest, testAppScript, testShellHtml } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("shellRoutes", () => {
  test.each(["/", "/document/docs/plan.md"])(
    "must serve the web app with a policy that only runs the server's scripts when %s is opened",
    async (url) => {
      const { request } = await setUpAppTest(getDirectory());

      const response = await request("GET", url, {});

      expect(response.headers.get("content-type")).toBe("text/html; charset=UTF-8");
      expect(response.headers.get("content-security-policy")).toContain("script-src 'self';");
      expect(await response.text()).toBe(testShellHtml);
    }
  );

  test("must serve the app's script with its type when the page loads it", async () => {
    const { request } = await setUpAppTest(getDirectory());

    const response = await request("GET", "/assets/app.js", {});

    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": "text/javascript; charset=utf-8",
      "x-content-type-options": "nosniff",
    });
    expect(await response.text()).toBe(testAppScript);
  });

  test.each(["/assets/missing.js", "/assets/..%2Findex.html"])(
    "must answer that the asset is missing when the page asks for %s",
    async (url) => {
      const { request } = await setUpAppTest(getDirectory());

      const response = await request("GET", url, {});

      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: { reason: "missing-file" } });
    }
  );

  test("must say the web app is missing when the build has none", async () => {
    const { request, webDirectory } = await setUpAppTest(getDirectory());
    await rm(path.join(webDirectory, "index.html"));

    const response = await request("GET", "/", {});

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { reason: "missing-web-app" } });
  });
});
````

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm vitest run --project node --project web src/server/http/shellRoutes.test.ts src/web/components/App`
Expected: FAIL. `App.test.tsx` fails with `Failed to resolve import "./App"`. The shell tests fail because the server still sends plan 2's placeholder page (`expected '<!doctype html>\n<html lang="en">…' to be '<!doctype html><title>Markdown Review…'`), there is no asset route, and a missing web app is not reported (`expected 200 to be 500`).

- [ ] **Step 5: Build the web app and serve it**

The web build's root is `src/web`, so its `index.html` loads `./main.tsx`, and the output goes to `dist/web/` beside `dist/cli.js`:

`vite.web.config.mts`:

````ts
import { fileURLToPath } from "node:url";

import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: { emptyOutDir: true, outDir: fileURLToPath(new URL("dist/web", import.meta.url)) },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  root: fileURLToPath(new URL("src/web", import.meta.url)),
});
````

`tsconfig.node.json`:

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
  "include": ["vite.config.mts", "vite.web.config.mts", "vitest.config.mts"]
}
````

`src/web/index.html`:

````html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Markdown Review</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
````

`src/web/main.tsx`:

````tsx
import "@krelborn/stylesui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./components/App/App";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("The page has no #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
````

`src/web/components/App/App.tsx`:

````tsx
import { Heading, Theme } from "@krelborn/stylesui";
import type { JSX } from "react";

/**
 * The review page
 */
export function App(): JSX.Element {
  return (
    <Theme mode="system">
      <Heading level={1}>Markdown Review</Heading>
    </Theme>
  );
}
````

The server reads the built app from the directory it is given. Assets are named by the build, so their path is checked as a repo-relative path and never decoded:

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

  /**
   * The built web app: `index.html` and its `assets/` directory
   */
  webDirectory: string;
}
````

`src/server/http/contentTypeFor.ts`:

````ts
import path from "node:path";

const contentTypes: Partial<Record<string, string>> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
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

`src/server/http/shellRoutes.ts`:

````ts
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Context, Hono } from "hono";

import { isRepositoryRelativePath } from "../../shared/review/isRepositoryRelativePath";
import { isFileNotFound } from "../files/isFileNotFound";
import { readTextFileOrNull } from "../files/readTextFileOrNull";

import type { AppDependencies } from "./AppDependencies";
import { contentTypeFor } from "./contentTypeFor";
import { HttpError } from "./HttpError";

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
      "Content-Type": contentTypeFor(name),
      "X-Content-Type-Options": "nosniff",
    });
  });
}
````

`src/server/http/createApp.ts`, changed as this diff shows:

````diff
--- a/src/server/http/createApp.ts
+++ b/src/server/http/createApp.ts
@@ -69,6 +69,6 @@ export function createApp(dependencies: AppDependencies): Hono {
   registerBrowserRoutes(app, dependencies);
   registerEventRoutes(app, dependencies);
   registerFileRoutes(app, dependencies);
-  registerShellRoutes(app);
+  registerShellRoutes(app, dependencies);
   return app;
 }
````

`src/server/runtime/runServer.ts`, changed as this diff shows:

````diff
--- a/src/server/runtime/runServer.ts
+++ b/src/server/runtime/runServer.ts
@@ -33,6 +33,11 @@ export interface RunServerOptions {
   idleMilliseconds?: number;
 
   pollKeepAliveMilliseconds?: number;
+
+  /**
+   * The built web app the server shows in the browser
+   */
+  webDirectory: string;
 }
 
 export interface RunningServer {
@@ -56,6 +61,7 @@ export async function runServer({
   logger,
   pollKeepAliveMilliseconds = 15_000,
   root,
+  webDirectory,
 }: RunServerOptions): Promise<RunningServer> {
   const store = new ReviewStore(root, logger);
   await store.initialize();
@@ -98,6 +104,7 @@ export async function runServer({
     token,
     version: packageVersion,
     watchDocument: (document) => watcher.watch(document),
+    webDirectory,
   });
   const server = createServer(getRequestListener(app.fetch));
   port = await listen(server, preferredPort(root));
````

`src/cli/commands/serveCommand.ts`:

````ts
import path from "node:path";
import { parseArgs } from "node:util";

import { createConsoleLogger } from "../../server/runtime/createConsoleLogger";
import { runServer } from "../../server/runtime/runServer";
import type { CliContext } from "../CliContext";
import { CliError } from "../CliError";

/**
 * Runs the review server in this process until it stops; the CLI starts it detached as `serve --root <root>`
 */
export async function serveCommand(args: string[], { cliPath }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { root: { type: "string" } } });
  if (values.root === undefined) {
    throw new CliError("serve needs --root <path>", "Run `markdown-review serve --root <repository root>`.", 2);
  }
  const server = await runServer({
    logger: createConsoleLogger(),
    root: values.root,
    webDirectory: path.join(path.dirname(cliPath), "web"),
  });
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

- [ ] **Step 6: Give the web directory to the tests that start a real server**

These tests never load the page, so a directory that does not exist will do:

`src/server/runtime/runServer.test.ts`, changed as this diff shows:

````diff
--- a/src/server/runtime/runServer.test.ts
+++ b/src/server/runtime/runServer.test.ts
@@ -87,7 +87,12 @@ async function setUpTest({ idleMilliseconds, root }: { idleMilliseconds?: number
   server: RunningServer;
 }> {
   const repositoryRoot = root ?? (await createRepository());
-  const server = await runServer({ idleMilliseconds, logger: createMemoryLogger().logger, root: repositoryRoot });
+  const server = await runServer({
+    idleMilliseconds,
+    logger: createMemoryLogger().logger,
+    root: repositoryRoot,
+    webDirectory: path.join(getDirectory(), "web"),
+  });
   cleanUps.unshift(() => server.close());
   return { root: repositoryRoot, server };
 }
````

`src/cli/connectToServer.test.ts`, changed as this diff shows:

````diff
--- a/src/cli/connectToServer.test.ts
+++ b/src/cli/connectToServer.test.ts
@@ -24,7 +24,11 @@ afterEach(async () => {
 describe("connectToServer", () => {
   test("must connect to the root's running server instead of starting another", async () => {
     const root = await createRoot();
-    const server = await runServer({ logger: createMemoryLogger().logger, root });
+    const server = await runServer({
+      logger: createMemoryLogger().logger,
+      root,
+      webDirectory: path.join(root, "unused-web"),
+    });
     cleanUps.push(() => server.close());
 
     const client = await connectToServer(root, path.join(root, "unused-cli.js"));
@@ -52,7 +56,11 @@ describe("connectToServer", () => {
 describe("waitUntilStopped", () => {
   test("must return once the server no longer answers after it has been asked to stop", async () => {
     const root = await createRoot();
-    const server = await runServer({ logger: createMemoryLogger().logger, root });
+    const server = await runServer({
+      logger: createMemoryLogger().logger,
+      root,
+      webDirectory: path.join(root, "unused-web"),
+    });
     const client = await connectToServer(root, path.join(root, "unused-cli.js"));
 
     await client.shutdown();
````

`src/cli/runCli.test.ts`, changed as this diff shows:

````diff
--- a/src/cli/runCli.test.ts
+++ b/src/cli/runCli.test.ts
@@ -104,7 +104,11 @@ describe("runCli", () => {
     await mkdir(path.join(otherRoot, "docs"), { recursive: true });
     await runCommand("git", ["init", "-q"], { cwd: otherRoot });
     await writeFile(path.join(otherRoot, "docs", "other.md"), "# Other\n");
-    running = await runServer({ logger: createMemoryLogger().logger, root: otherRoot });
+    running = await runServer({
+      logger: createMemoryLogger().logger,
+      root: otherRoot,
+      webDirectory: path.join(otherRoot, "unused-web"),
+    });
 
     const { exitCode, stdout } = await run(["open", "../other/docs/other.md"]);
 
@@ -183,7 +187,11 @@ async function setUpTest({ inGit = true, withServer = false }: SetUpOptions = {}
   }
   await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
   if (withServer) {
-    running = await runServer({ logger: createMemoryLogger().logger, root });
+    running = await runServer({
+      logger: createMemoryLogger().logger,
+      root,
+      webDirectory: path.join(root, "unused-web"),
+    });
   }
   const start = (args: string[]) => {
     let stdout = "";
````

`src/cli/ServerClient.test.ts`, changed as this diff shows:

````diff
--- a/src/cli/ServerClient.test.ts
+++ b/src/cli/ServerClient.test.ts
@@ -70,7 +70,11 @@ async function setUpTest() {
   const root = path.join(getDirectory(), "repo");
   await mkdir(path.join(root, "docs"), { recursive: true });
   await writeFile(path.join(root, "docs", "plan.md"), "# Plan\n");
-  const server = await runServer({ logger: createMemoryLogger().logger, root });
+  const server = await runServer({
+    logger: createMemoryLogger().logger,
+    root,
+    webDirectory: path.join(root, "unused-web"),
+  });
   running = server;
   const { port, token } = serverFileSchema.parse(JSON.parse(await readFile(serverFilePath(root), "utf8")));
   const client = new ServerClient(port, token);
````

- [ ] **Step 7: Add the build scripts, the fallow entry, CI's token and the docs**

In `package.json`, set these two scripts (then run `pnpm format`, which sorts them):

```json
"build": "vite build && vite build --config vite.web.config.mts",
"prepublishOnly": "pnpm build"
```

fallow needs the web entry, because Vite's root is `src/web` rather than the repo root:

`.fallowrc.json`:

````json
{
  "$schema": "https://raw.githubusercontent.com/fallow-rs/fallow/main/schema.json",
  "entry": ["src/cli/main.ts", "src/web/main.tsx"]
}
````

CI installs StylesUI with the job's token:

`.github/workflows/ci.yml`:

````yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  packages: read

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      # .npmrc reads it to install @krelborn/stylesui from GitHub Packages
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
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

`AGENTS.md`:

````markdown
# AGENTS.md

Markdown Review: a local tool for reviewing agent-written markdown in a browser and handing the comments back to the coding agent through a CLI. The design is `docs/superpowers/specs/2026-10-08-markdown-review-design.md`; the build plans are in `docs/superpowers/plans/`.

## Commands

- `pnpm build`: build the CLI and server into `dist/cli.js`, and the web app into `dist/web/`, which the server serves
- `pnpm test`: all tests: the `node` project (`src/cli`, `src/server`, `src/shared`), the `web` project in jsdom (`src/web`), and the `integration` project, which builds `dist/cli.js` first and runs it as separate processes against temporary git repositories
- `pnpm test:coverage`: tests with v8 coverage, written to `coverage/istanbul.json`
- `pnpm verify`: lint, format check, typecheck and tests
- Try the agent loop by hand: `pnpm build`, then in any git repository run `node <this repo>/dist/cli.js open <doc.md>`, `inbox`, `poll`, `reply`, `resolve` and `stop`. Set `MARKDOWN_REVIEW_NO_BROWSER=1` to keep `open` from launching a browser.

## Layout

- `src/shared/`: code the server and the browser both run: the markdown-it configuration, blocks and canonical text, and the zod schemas of the review model. No Node or DOM APIs.
- `src/server/`: the anchorer and the review store; `http/` holds the Hono app (agent routes, browser routes, poll, event stream, repo files, app shell) and `runtime/` runs it as the per-repo server process.
- `src/cli/`: the agent's CLI. `main.ts` is the bin entry; the CLI starts the server by running itself as `serve --root <root>`, detached.
- `src/integration/`: tests that drive the built CLI the way an agent does.
- `src/web/`: the React app the server serves, built with `vite.web.config.mts` from `src/web/index.html`. `components/` holds one folder per component; `rendering/` holds the walk that reads canonical text from rendered blocks, and the conformance test that checks it against `src/shared`.

## Protocol

`protocolVersion` in `src/shared/api/protocolVersion.ts` versions the HTTP API and the store format together. Bump it for any change an older CLI or server could not handle: the CLI replaces a server of an older protocol and refuses to touch one of a newer protocol. `server.json` and `GET /api/health` are how every version finds that protocol, so they may gain fields but must keep the ones they have.

## Anchoring

Comments anchor to offsets in a doc's canonical text, which `parseBlocks` computes from markdown-it tokens and the browser reads back from the rendered page with `layOutBlockText`. The two must agree exactly: run the `web` project's conformance test after any change to `createMarkdownIt`, the markdown plugins, Shiki or DOMPurify, and add a case to `src/web/rendering/testing/conformanceCorpus.md` for any new kind of content.

Install dependencies with `pnpm add` and no hand-written version, then run `pnpm format`, which sorts `package.json`. `@krelborn/stylesui` comes from GitHub Packages, and `.npmrc` reads a token with `read:packages` from `GITHUB_TOKEN`, so run pnpm as `GITHUB_TOKEN=$(gh auth token) pnpm install`.

## Fallow

fallow is a devDependency; run it as `pnpm exec fallow`. Its skill is `node_modules/fallow/skills/fallow/SKILL.md`.

- The husky pre-commit hook runs `fallow audit` on every commit after the first. A `fail` verdict blocks the commit: fix the findings it reports. Only findings the commit introduces count, so every new export must be used by code or tests in the same commit.
- The commit check estimates test coverage from which tests import a function. For exact CRAP scores run `pnpm test:coverage`, then `pnpm exec fallow health --coverage coverage/istanbul.json`.
- To refresh the skill pointers and MCP config after upgrading fallow, run `pnpm exec fallow agent install --harness claude --harness codex --without guide --without hooks`.
````

- [ ] **Step 8: Run the tests to verify they pass**

Run: `pnpm vitest run --project node --project web src/server/http/shellRoutes.test.ts src/web/components/App`
Expected: PASS, 7 tests.

Run: `pnpm verify`, then `pnpm build`, then `pnpm exec fallow audit`
Expected: `pnpm verify` is clean with 373 tests. `pnpm build` writes `dist/cli.js`, `dist/web/index.html` and `dist/web/assets/`. fallow's verdict is `warn`, only for the browser devDependencies used in production code.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Build the React web app and serve it from the review server"
```

---

### Task 2: Refuse requests from pages on other sites

**Files:**
- Modify: `src/server/http/securityMiddleware.ts`, `src/server/http/createApp.ts`
- Test: `src/server/http/securityMiddleware.test.ts`

**Interfaces:**
- Consumes:
  - `requireLocalHost`, `requireAgentToken` and `requireBrowserOrigin` (plan 2).
- Produces:
  - `refuseOtherOrigins(port: () => number): MiddlewareHandler`, applied to every route after the Host check. A request with an `Origin` header that is not `http://127.0.0.1:<port>` or `http://localhost:<port>` gets 403 `forbidden`. Same-origin GETs, including the page's `EventSource`, carry no `Origin`, and agent routes already refuse any `Origin`.

- [ ] **Step 1: Write the failing tests**

Plan 2's final review found that a page on another site could open `/api/events`: the browser refuses it the response, but the server has already counted it as the latest tab, so the agent's `navigate` would go to it.

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

  test.each(["/", "/api/threads?all=1", "/files/docs/plan.md"])(
    "must refuse a page on another site when it requests %s",
    async (url) => {
      const { request } = await setUpTest();

      const response = await request("GET", url, { origin: "http://evil.example" });

      expect(response.status).toBe(403);
    }
  );

  test("must not count a page on another site as a review tab when it opens the event stream", async () => {
    const { request, tabs } = await setUpTest();

    const response = await request("GET", "/api/events", { origin: "http://evil.example" });

    expect(response.status).toBe(403);
    expect(tabs.navigateLatest("/")).toBe(false);
  });

  test("must answer the server's own page when it was opened on localhost", async () => {
    const { request } = await setUpTest();

    const response = await request("GET", "/api/threads?all=1", { origin: `http://localhost:${testPort}` });

    expect(response.status).toBe(200);
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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project node src/server/http/securityMiddleware.test.ts`
Expected: FAIL, 4 tests, each with `expected 200 to be 403`.

- [ ] **Step 3: Refuse other origins**

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
````

`src/server/http/createApp.ts`:

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
import { refuseOtherOrigins, requireAgentToken, requireBrowserOrigin, requireLocalHost } from "./securityMiddleware";
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
  app.use("*", refuseOtherOrigins(port));
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
  registerShellRoutes(app, dependencies);
  return app;
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project node src/server/http/securityMiddleware.test.ts`
Expected: PASS, 10 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 378 tests; fallow `warn` as before.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Refuse requests from pages on other sites, so they cannot pose as a review tab"
```

---

### Task 3: The browser's client for the server's API and event stream

**Files:**
- Create: `src/web/api/reviewEventSchema.ts`, `src/web/api/ReviewApi.ts`, `src/web/api/ReviewApiError.ts`, `src/web/api/createReviewApi.ts`
- Modify: `src/shared/api/apiResponseSchemas.ts`, `src/server/http/browserRoutes.ts`
- Test: `src/shared/api/apiResponseSchemas.test.ts`, `src/web/api/createReviewApi.test.ts`

**Interfaces:**
- Consumes:
  - `threadsSnapshotSchema`/`ThreadsSnapshot`, `apiErrorSchema` and `Verdict` (plan 2); `documentPathSchema` and `NewThread` (plan 1).
- Produces:
  - `documentListSchema`/`DocumentList` (`{ documents: DocumentCount[]; problems: string[]; recent: string[] }`), `DocumentCount` (`{ document; draftCount; openCount }`), and `documentSourceSchema`/`DocumentSource` (`{ hash; path; source }`), in `src/shared/api/apiResponseSchemas.ts`. `browserRoutes.ts` types its `GET /api/documents` and `GET /api/document` responses with them.
  - `reviewEventSchema`/`ReviewEvent`: `{ type: "presence"; agentWaiting }`, `{ type: "threads-changed" }`, `{ type: "document-changed"; document }`, `{ type: "navigate"; url }`, `{ type: "connected" }` and `{ type: "disconnected" }`.
  - `interface ReviewApi` with `createThread(newThread: NewThread)`, `deleteDraft(id)`, `readDocument(document): Promise<DocumentSource>`, `readDocuments(): Promise<DocumentList>`, `readThreads(): Promise<ThreadsSnapshot>` (every thread, `?all=1`), `resolveThread(id)`, `submit(verdict)`, `writeDraft(id, body)`, and `subscribe(listener: (event: ReviewEvent) => void): () => void`. The mutations return `Promise<void>`.
  - `class ReviewApiError extends Error` with `reason: string` and `status: number`.
  - `createReviewApi(): ReviewApi`, over `fetch` and one `EventSource("/api/events")` per `subscribe`.

- [ ] **Step 1: Write the failing tests**

The tests stub `fetch` and `EventSource`, the network boundary, and check what goes over it:

`src/shared/api/apiResponseSchemas.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { buildThread, testTime } from "../review/testing/reviewBuilders";

import type {
  AgentOpenResponse,
  AgentThreadResponse,
  DocumentList,
  DocumentSource,
  Health,
  PollResponse,
  ShutdownResponse,
  ThreadsSnapshot,
} from "./apiResponseSchemas";
import {
  agentOpenResponseSchema,
  agentThreadResponseSchema,
  apiErrorSchema,
  documentListSchema,
  documentSourceSchema,
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
    const documents: DocumentList = {
      documents: [{ document: "docs/plan.md", draftCount: 1, openCount: 2 }],
      problems: [],
      recent: ["docs/spec.md"],
    };
    const source: DocumentSource = { hash: "a".repeat(64), path: "docs/plan.md", source: "# Plan\n" };

    expect(healthSchema.parse(health)).toEqual(health);
    expect(threadsSnapshotSchema.parse(inbox)).toEqual(inbox);
    expect(pollResponseSchema.parse(poll)).toEqual(poll);
    expect(agentOpenResponseSchema.parse(opened)).toEqual(opened);
    expect(agentThreadResponseSchema.parse(acted)).toEqual(acted);
    expect(shutdownResponseSchema.parse(stopping)).toEqual(stopping);
    expect(documentListSchema.parse(documents)).toEqual(documents);
    expect(documentSourceSchema.parse(source)).toEqual(source);
  });

  test("must recognise an error response when the server refuses a request", () => {
    expect(apiErrorSchema.safeParse({ error: { message: "No thread #9", reason: "unknown-thread" } }).success).toBe(
      true
    );
  });
});
````

`src/web/api/createReviewApi.test.ts`:

````ts
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
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project node --project web src/shared/api/apiResponseSchemas.test.ts src/web/api`
Expected: FAIL. `createReviewApi.test.ts` with `Failed to resolve import "./createReviewApi"`, and the schema test with `TypeError: Cannot read properties of undefined (reading 'parse')`.

- [ ] **Step 3: Add the response schemas and type the browser routes with them**

`src/shared/api/apiResponseSchemas.ts`:

````ts
import { z } from "zod";

import { documentPathSchema } from "../review/anchorSchema";
import type { ReviewState } from "../review/ReviewState";
import { threadSchema } from "../review/threadSchema";

const reviewStateSchema = z.strictObject({
  approved: z.boolean(),
  approvedAt: z.iso.datetime().nullable(),
  requestedAt: z.iso.datetime().nullable(),
}) satisfies z.ZodType<ReviewState>;

/**
 * Not strict, so a newer server that reports more fields is still recognised by its protocol rather than mistaken for
 * no server
 */
export const healthSchema = z.object({
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

export const documentListSchema = z.strictObject({
  documents: z.array(
    z.strictObject({
      document: documentPathSchema,
      draftCount: z.int().nonnegative(),
      openCount: z.int().nonnegative(),
    })
  ),
  problems: z.array(z.string()),
  recent: z.array(documentPathSchema),
});

export const documentSourceSchema = z.strictObject({ hash: z.string(), path: documentPathSchema, source: z.string() });

export const apiErrorSchema = z.strictObject({ error: z.strictObject({ message: z.string(), reason: z.string() }) });

export type Health = z.infer<typeof healthSchema>;
export type ThreadsSnapshot = z.infer<typeof threadsSnapshotSchema>;
export type PollResponse = z.infer<typeof pollResponseSchema>;
export type AgentOpenResponse = z.infer<typeof agentOpenResponseSchema>;
export type AgentThreadResponse = z.infer<typeof agentThreadResponseSchema>;
export type ShutdownResponse = z.infer<typeof shutdownResponseSchema>;
export type DocumentList = z.infer<typeof documentListSchema>;
export type DocumentCount = DocumentList["documents"][number];
export type DocumentSource = z.infer<typeof documentSourceSchema>;
````

`src/server/http/browserRoutes.ts`:

````ts
import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Hono } from "hono";

import { messageRequestSchema, submitRequestSchema } from "../../shared/api/apiRequestSchemas";
import type { DocumentCount, DocumentList, DocumentSource } from "../../shared/api/apiResponseSchemas";
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
    const response: DocumentList = { documents: countByDocument(threads), problems, recent: recentDocuments.list() };
    return context.json(response);
  });

  app.get("/api/document", async (context) => {
    const document = context.req.query("path") ?? "";
    await checkDocumentPath(root, document, false);
    const source = await readFile(path.join(root, ...document.split("/")), "utf8");
    recentDocuments.add(document);
    watchDocument(document);
    const response: DocumentSource = { hash: hashSource(source), path: document, source };
    return context.json(response);
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

function countByDocument(threads: readonly Thread[]): DocumentCount[] {
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

- [ ] **Step 4: Write the client**

`src/web/api/reviewEventSchema.ts`:

````ts
import { z } from "zod";

import { documentPathSchema } from "../../shared/review/anchorSchema";

/**
 * What the server pushes to a review tab, and the tab's connection to it opening or dropping
 */
export const reviewEventSchema = z.discriminatedUnion("type", [
  z.strictObject({ agentWaiting: z.boolean(), type: z.literal("presence") }),
  z.strictObject({ type: z.literal("threads-changed") }),
  z.strictObject({ document: documentPathSchema, type: z.literal("document-changed") }),
  z.strictObject({ type: z.literal("navigate"), url: z.string() }),
  z.strictObject({ type: z.literal("connected") }),
  z.strictObject({ type: z.literal("disconnected") }),
]);

export type ReviewEvent = z.infer<typeof reviewEventSchema>;
````

`src/web/api/ReviewApi.ts`:

````ts
import type { Verdict } from "../../shared/api/apiRequestSchemas";
import type { DocumentList, DocumentSource, ThreadsSnapshot } from "../../shared/api/apiResponseSchemas";
import type { NewThread } from "../../shared/review/newThreadSchema";

import type { ReviewEvent } from "./reviewEventSchema";

/**
 * The review server as the browser sees it; each method rejects with a `ReviewApiError` when the server refuses
 */
export interface ReviewApi {
  createThread(newThread: NewThread): Promise<void>;
  deleteDraft(id: number): Promise<void>;
  readDocument(document: string): Promise<DocumentSource>;
  readDocuments(): Promise<DocumentList>;

  /**
   * Reads every thread in the repo, with the review's state
   */
  readThreads(): Promise<ThreadsSnapshot>;

  resolveThread(id: number): Promise<void>;
  submit(verdict: Verdict): Promise<void>;

  /**
   * Listens to the server's events until the returned function is called
   */
  subscribe(listener: (event: ReviewEvent) => void): () => void;

  writeDraft(id: number, body: string): Promise<void>;
}
````

`src/web/api/ReviewApiError.ts`:

````ts
/**
 * A request the review server refused, with the stable reason it gave
 */
export class ReviewApiError extends Error {
  public readonly reason: string;
  public readonly status: number;

  public constructor(status: number, reason: string, message: string) {
    super(message);
    this.name = "ReviewApiError";
    this.reason = reason;
    this.status = status;
  }
}
````

`src/web/api/createReviewApi.ts`:

````ts
import {
  apiErrorSchema,
  documentListSchema,
  documentSourceSchema,
  threadsSnapshotSchema,
} from "../../shared/api/apiResponseSchemas";

import type { ReviewApi } from "./ReviewApi";
import { ReviewApiError } from "./ReviewApiError";
import type { ReviewEvent } from "./reviewEventSchema";
import { reviewEventSchema } from "./reviewEventSchema";

const pushedEventTypes = ["presence", "threads-changed", "document-changed", "navigate"] as const;

/**
 * Creates the API of the server that served the page
 *
 * @returns an API whose changes are sent as JSON from the page's own origin, as the server requires
 */
export function createReviewApi(): ReviewApi {
  return {
    createThread: (newThread) => send("POST", "/api/threads", newThread),
    deleteDraft: (id) => send("DELETE", `/api/threads/${id}/draft`),
    readDocument: async (document) =>
      documentSourceSchema.parse(await receive(`/api/document?path=${encodeURIComponent(document)}`)),
    readDocuments: async () => documentListSchema.parse(await receive("/api/documents")),
    readThreads: async () => threadsSnapshotSchema.parse(await receive("/api/threads?all=1")),
    resolveThread: (id) => send("POST", `/api/threads/${id}/resolve`),
    submit: (verdict) => send("POST", "/api/submit", { verdict }),
    subscribe: subscribeToEvents,
    writeDraft: (id, body) => send("PUT", `/api/threads/${id}/draft`, { body }),
  };
}

async function receive(url: string): Promise<unknown> {
  return readBody(await fetch(url));
}

async function send(method: string, url: string, body?: unknown): Promise<void> {
  await readBody(
    await fetch(url, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method,
    })
  );
}

async function readBody(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok) {
    return body;
  }
  const refusal = apiErrorSchema.safeParse(body);
  if (!refusal.success) {
    throw new ReviewApiError(response.status, "unknown", `The review server answered ${response.status}`);
  }
  throw new ReviewApiError(response.status, refusal.data.error.reason, refusal.data.error.message);
}

function subscribeToEvents(listener: (event: ReviewEvent) => void): () => void {
  const source = new EventSource("/api/events");
  source.addEventListener("open", () => listener({ type: "connected" }));
  source.addEventListener("error", () => listener({ type: "disconnected" }));
  for (const type of pushedEventTypes) {
    source.addEventListener(type, (message) => {
      listener(reviewEventSchema.parse({ ...JSON.parse(message.data), type }));
    });
  }
  return () => source.close();
}
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project node --project web src/shared/api/apiResponseSchemas.test.ts src/web/api`
Expected: PASS, 9 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 385 tests; fallow `warn`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Give the browser a client for the server's API and event stream"
```

---

### Task 4: Render a doc for the review page

**Files:**
- Create: `src/web/rendering/findFenceLanguages.ts`, `src/web/rendering/loadHighlight.ts`, `src/web/rendering/addHeadingIds.ts`, `src/web/rendering/pointLinksAtReview.ts`, `src/web/rendering/renderDocument.ts`, `src/web/rendering/renderMermaidDiagrams.ts`, `src/web/global.css`
- Modify: `package.json`, `src/web/main.tsx`
- Test: `src/web/rendering/renderDocument.test.ts`, `src/web/rendering/renderMermaidDiagrams.test.ts`, `src/web/rendering/blockConformance.test.ts`

**Interfaces:**
- Consumes:
  - `createMarkdownIt({ highlight })`, `Highlight`, `fenceLanguage`, `parseBlocks` (plan 1); `sanitizeRenderedHtml` and `layOutBlockText` (plan 1, `src/web/rendering/`).
- Produces:
  - `renderDocument(source: string, documentPath: string): Promise<string>`: sanitized HTML whose leaf blocks carry `data-md-block`, `data-md-start` and `data-md-end`, with fenced code highlighted in both GitHub themes, headings given GitHub's ids, and links and images pointed at the app.
    - A relative `.md` link becomes `/document/<path>#hash`.
    - Another relative file becomes `/files/<path>` with `target="_blank"`.
    - A URL with a scheme keeps its address and gets `target="_blank" rel="noopener noreferrer"`.
  - `renderMermaidDiagrams(container: Element): Promise<void>`: replaces each `pre > code.language-mermaid` with Mermaid's SVG, importing Mermaid only when there is one; a diagram Mermaid cannot parse keeps its source.
  - `loadHighlight(languages)`, `findFenceLanguages(source)`, `addHeadingIds(container)` and `pointLinksAtReview(container, documentPath)`, used by `renderDocument`.
  - `src/web/global.css`, imported by `main.tsx`: Shiki's dark theme under `prefers-color-scheme: dark`.
  - The conformance test now renders through `renderDocument`, so it checks the page the app actually shows.

- [ ] **Step 1: Install Mermaid**

```bash
pnpm add -D mermaid
pnpm format
```

- [ ] **Step 2: Write the failing tests**

`renderMermaidDiagrams.test.ts` mocks the `mermaid` module, a third-party renderer that needs a real layout engine, and stubs `matchMedia`, which jsdom lacks. The conformance test switches from its own Shiki setup to `renderDocument`:

`src/web/rendering/renderDocument.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { renderDocument } from "./renderDocument";

describe("renderDocument", () => {
  test("must highlight fenced code when the doc names a language Shiki knows", async () => {
    const page = await renderPage("```TS\nconst ttl = 3600;\n```\n");

    expect(page.querySelector('[data-md-block="0"] > pre.shiki')?.textContent).toBe("const ttl = 3600;");
  });

  test.each(["mermaid", "not-a-language"])(
    "must leave the code plain when the fence's language is %s",
    async (language) => {
      const page = await renderPage(`\`\`\`${language}\ngraph TD\n\`\`\`\n`);

      expect(page.querySelector('[data-md-block="0"] > pre > code')?.className).toBe(`language-${language}`);
    }
  );

  test.each([
    {
      condition: "another doc",
      markdown: "[Spec](../spec.md#goals)",
      href: "/document/docs/spec.md#goals",
      target: null,
    },
    {
      condition: "a doc from the repo root",
      markdown: "[Readme](/README.md)",
      href: "/document/README.md",
      target: null,
    },
    {
      condition: "another file",
      markdown: "[Report](<data/Q3 report.csv>)",
      href: "/files/docs/plans/data/Q3%20report.csv",
      target: "_blank",
    },
    {
      condition: "another site",
      markdown: "[Site](https://example.com/a)",
      href: "https://example.com/a",
      target: "_blank",
    },
    { condition: "a heading in the doc", markdown: "[Goals](#goals)", href: "#goals", target: null },
  ])("must point the link at the right page when it goes to $condition", async ({ href, markdown, target }) => {
    const page = await renderPage(markdown);

    const link = page.querySelector("a");
    expect(link?.getAttribute("href")).toBe(href);
    expect(link?.getAttribute("target")).toBe(target);
  });

  test("must load an image from the repo's files when the doc gives a relative path", async () => {
    const page = await renderPage("![Flow](<Flow Chart.png>)");

    expect(page.querySelector("img")?.getAttribute("src")).toBe("/files/docs/plans/Flow%20Chart.png");
  });

  test("must give headings GitHub's ids when the doc has headings, including repeated ones", async () => {
    const page = await renderPage("# Retry Policy (v2)\n\n## Notes\n\n## Notes\n");

    expect([...page.querySelectorAll("h1, h2")].map((heading) => heading.id)).toEqual([
      "retry-policy-v2",
      "notes",
      "notes-1",
    ]);
  });
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plans/plan.md");
  return page;
}
````

`src/web/rendering/renderMermaidDiagrams.test.ts`:

````ts
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { renderDocument } from "./renderDocument";
import { renderMermaidDiagrams } from "./renderMermaidDiagrams";

const mermaid = vi.hoisted(() => ({ initialize: vi.fn(), parse: vi.fn(), render: vi.fn() }));

vi.mock("mermaid", () => ({ default: mermaid }));

const diagramSource = "```mermaid\ngraph TD\n  A-->B\n```\n";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  mermaid.render.mockResolvedValue({ svg: '<svg aria-label="Request flow"><text>A</text></svg>' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("renderMermaidDiagrams", () => {
  test("must draw the diagram in its block in place of its source when the doc has a Mermaid fence", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue({ diagramType: "flowchart-v2" });

    await renderMermaidDiagrams(page);

    expect(page.querySelector('[data-md-block="0"] > svg')?.getAttribute("aria-label")).toBe("Request flow");
    expect(page.querySelector("pre")).toBeNull();
  });

  test("must keep showing the source when Mermaid cannot read the diagram", async () => {
    const page = await renderPage(diagramSource);
    mermaid.parse.mockResolvedValue(false);

    await renderMermaidDiagrams(page);

    expect(page.querySelector('[data-md-block="0"] > pre')?.textContent).toBe("graph TD\n  A-->B");
  });
});

async function renderPage(source: string): Promise<HTMLElement> {
  const page = document.createElement("div");
  page.innerHTML = await renderDocument(source, "docs/plan.md");
  return page;
}
````

`src/web/rendering/blockConformance.test.ts`:

````ts
import { beforeAll, describe, expect, test } from "vitest";

import { parseBlocks } from "../../shared/markdown/parseBlocks";

import { layOutBlockText } from "./layOutBlockText";
import { renderDocument } from "./renderDocument";
import conformanceCorpus from "./testing/conformanceCorpus.md?raw";

const blocks = parseBlocks(conformanceCorpus).map((block, index) => ({ ...block, index }));

describe("rendered blocks", () => {
  beforeAll(async () => {
    document.body.innerHTML = await renderDocument(conformanceCorpus, "docs/corpus.md");
  });

  test.each(blocks)("must tag exactly one element with block $index and its lines", ({ index, startLine, endLine }) => {
    const elements = document.querySelectorAll(`[data-md-block="${index}"]`);

    expect(elements.length).toBe(1);
    expect(elements[0]?.getAttribute("data-md-start")).toBe(String(startLine));
    expect(elements[0]?.getAttribute("data-md-end")).toBe(String(endLine));
  });

  test.each(blocks.filter((block) => !block.wholeBlockOnly))(
    "must read the canonical text of block $index from the rendered page",
    ({ index, text }) => {
      const element = document.querySelector(`[data-md-block="${index}"]`);

      expect(element === null ? null : layOutBlockText(element).text).toBe(text);
    }
  );
});
````

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run --project web src/web/rendering`
Expected: FAIL. The three files fail with `Failed to resolve import "./renderDocument"`; plan 1's `layOutBlockText` and `sanitizeRenderedHtml` tests still pass.

- [ ] **Step 4: Write the rendering pipeline**

`createHighlighterCore` is created once, with no languages, and each doc loads the grammars its fences name. `bundledLanguages` maps names and aliases (`ts`, `sh`, …) to dynamic imports, so Vite gives each grammar its own chunk:

`src/web/rendering/findFenceLanguages.ts`:

````ts
import { createMarkdownIt } from "../../shared/markdown/createMarkdownIt";
import { fenceLanguage } from "../../shared/markdown/fenceLanguage";

const markdown = createMarkdownIt();

/**
 * Lists the languages a doc's fenced code blocks name
 *
 * @param source the doc's markdown
 * @returns each language once, as written in the first fence that names it
 */
export function findFenceLanguages(source: string): string[] {
  const languages = markdown
    .parse(source, {})
    .filter((token) => token.type === "fence")
    .map((token) => fenceLanguage(token.info))
    .filter((language) => language !== "");
  return [...new Set(languages)];
}
````

`src/web/rendering/loadHighlight.ts`:

````ts
import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { BundledLanguage } from "shiki/langs";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

import type { Highlight } from "../../shared/markdown/createMarkdownIt";

let highlighter: Promise<HighlighterCore> | undefined;

/**
 * Prepares syntax highlighting for the languages of a doc's fenced code
 *
 * @param languages the languages the doc's fences name, in any case
 * @returns a highlight function for `createMarkdownIt` that colours code in the light and dark themes; code in a
 *   language Shiki does not know, and Mermaid diagrams, stay plain
 */
export async function loadHighlight(languages: readonly string[]): Promise<Highlight> {
  highlighter ??= createHighlighterCore({
    // The app's Content Security Policy does not allow the WebAssembly that Shiki's default engine compiles
    engine: createJavaScriptRegexEngine({ forgiving: true }),
    themes: [bundledThemes["github-light"], bundledThemes["github-dark"]],
  });
  const loaded = await highlighter;
  const known = languages.map((language) => language.toLowerCase()).filter(isHighlightable);
  await loaded.loadLanguage(...known.map((language) => bundledLanguages[language]));
  return (code, language) =>
    isHighlightable(language.toLowerCase())
      ? loaded.codeToHtml(code, {
          lang: language.toLowerCase(),
          themes: { dark: "github-dark", light: "github-light" },
        })
      : null;
}

function isHighlightable(language: string): language is BundledLanguage {
  return language !== "mermaid" && Object.hasOwn(bundledLanguages, language);
}
````

`src/web/rendering/addHeadingIds.ts`:

````ts
/**
 * Gives a rendered doc's headings the ids GitHub gives them, so `#heading` links work as they do on GitHub
 *
 * @param container the rendered doc
 */
export function addHeadingIds(container: ParentNode): void {
  const used = new Map<string, number>();
  for (const heading of container.querySelectorAll("h1, h2, h3, h4, h5, h6")) {
    const slug = slugify(heading.textContent);
    const count = used.get(slug) ?? 0;
    used.set(slug, count + 1);
    heading.id = count === 0 ? slug : `${slug}-${count}`;
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}
````

`src/web/rendering/pointLinksAtReview.ts`:

````ts
const repositoryBase = "https://repository.invalid/";

/**
 * Points a rendered doc's relative links and images at the review app: a link to another markdown doc opens it for
 * review, other repo files are served from the repo, and links that leave the review open in a new tab
 *
 * @param container the rendered doc
 * @param documentPath the doc's repo-relative path, which relative URLs resolve against; a path starting with "/"
 *   starts at the repo root, as on GitHub
 */
export function pointLinksAtReview(container: ParentNode, documentPath: string): void {
  for (const link of container.querySelectorAll("a[href]")) {
    pointLinkAtReview(link, documentPath);
  }
  for (const image of container.querySelectorAll("img[src]")) {
    const repositoryUrl = toRepositoryUrl(image.getAttribute("src") ?? "", documentPath);
    if (repositoryUrl !== null) {
      image.setAttribute("src", `/files${repositoryUrl.pathname}`);
    }
  }
}

function pointLinkAtReview(link: Element, documentPath: string): void {
  const href = link.getAttribute("href") ?? "";
  if (href.startsWith("#")) {
    return;
  }
  const repositoryUrl = toRepositoryUrl(href, documentPath);
  if (repositoryUrl?.pathname.toLowerCase().endsWith(".md")) {
    link.setAttribute("href", `/document${repositoryUrl.pathname}${repositoryUrl.hash}`);
    return;
  }
  if (repositoryUrl !== null) {
    link.setAttribute("href", `/files${repositoryUrl.pathname}${repositoryUrl.hash}`);
  }
  link.setAttribute("rel", "noopener noreferrer");
  link.setAttribute("target", "_blank");
}

/**
 * @returns the URL inside the repo that a relative URL names, or null for a URL with a scheme or host of its own
 */
function toRepositoryUrl(href: string, documentPath: string): URL | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) {
    return null;
  }
  return new URL(href, new URL(documentPath.split("/").map(encodeURIComponent).join("/"), repositoryBase));
}
````

`src/web/rendering/renderDocument.ts`:

````ts
import { createMarkdownIt } from "../../shared/markdown/createMarkdownIt";

import { addHeadingIds } from "./addHeadingIds";
import { findFenceLanguages } from "./findFenceLanguages";
import { loadHighlight } from "./loadHighlight";
import { pointLinksAtReview } from "./pointLinksAtReview";
import { sanitizeRenderedHtml } from "./sanitizeRenderedHtml";

/**
 * Renders a doc for the review page
 *
 * @param source the doc's markdown
 * @param documentPath the doc's repo-relative path
 * @returns sanitized HTML whose leaf block elements carry `data-md-block`, `data-md-start` and `data-md-end`, with
 *   fenced code highlighted, headings given GitHub's ids, and links and images pointed at the review app
 */
export async function renderDocument(source: string, documentPath: string): Promise<string> {
  const highlight = await loadHighlight(findFenceLanguages(source));
  const template = document.createElement("template");
  template.innerHTML = sanitizeRenderedHtml(createMarkdownIt({ highlight }).render(source));
  addHeadingIds(template.content);
  pointLinksAtReview(template.content, documentPath);
  return template.innerHTML;
}
````

`src/web/rendering/renderMermaidDiagrams.ts`:

````ts
/**
 * Draws a rendered doc's Mermaid diagrams in place of their source, loading Mermaid only when the doc has a diagram
 *
 * @param container the rendered doc
 * @returns once every diagram is drawn; a diagram Mermaid cannot read keeps showing its source
 */
export async function renderMermaidDiagrams(container: Element): Promise<void> {
  const sources = [...container.querySelectorAll("pre > code.language-mermaid")];
  if (sources.length === 0) {
    return;
  }
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    securityLevel: "strict",
    startOnLoad: false,
    theme: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
  });
  for (const [index, source] of sources.entries()) {
    const definition = source.textContent;
    if ((await mermaid.parse(definition, { suppressErrors: true })) === false) {
      continue;
    }
    const { svg } = await mermaid.render(`mermaid-diagram-${index}`, definition);
    const diagram = document.createElement("template");
    diagram.innerHTML = svg;
    source.parentElement?.replaceWith(diagram.content);
  }
}
````

Shiki writes the dark theme's colours into custom properties, and a global stylesheet applies them, because the code blocks come from rendered HTML that no CSS module can reach:

`src/web/global.css`:

````css
/* Shiki writes the dark theme's colours into custom properties, which take over when the system is in dark mode */
@media (prefers-color-scheme: dark) {
  .shiki,
  .shiki span {
    background-color: var(--shiki-dark-bg) !important;
    color: var(--shiki-dark) !important;
  }
}
````

`src/web/main.tsx`:

````tsx
import "@krelborn/stylesui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./components/App/App";
import "./global.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("The page has no #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project web src/web/rendering`
Expected: PASS, 71 tests, the conformance corpus among them.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 397 tests; fallow `warn`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Render a doc for the review page with highlighted code, diagrams and links that stay in the app"
```

---

### Task 5: Map between the rendered page and the doc's canonical text

**Files:**
- Create: `src/web/anchoring/PagePoint.ts`, `src/web/anchoring/blockElementAt.ts`, `src/web/anchoring/offsetInDocument.ts`, `src/web/anchoring/passageAnchor.ts`, `src/web/anchoring/selectedPassage.ts`, `src/web/anchoring/rangeForPassage.ts`, `src/web/anchoring/offsetAtPoint.ts`, `src/web/testing/mountDocument.ts`
- Test: `src/web/anchoring/selectedPassage.test.ts`, `src/web/anchoring/rangeForPassage.test.ts`, `src/web/anchoring/offsetAtPoint.test.ts`

**Interfaces:**
- Consumes:
  - `layOutBlockText(element): BlockTextLayout` (plan 1); `DocumentText`, `createDocumentText`, `blockAtOffset` (plan 1); `contextLength` and `NewPassageAnchor` (plan 1); `renderDocument` (Task 4).
- Produces:
  - `interface PagePoint { node: Node; offset: number }` and `type PassageEdge = "start" | "end"`.
  - `blockElementAt(container, node): Element | null`: the `data-md-block` element a node is in.
  - `offsetInDocument(container, documentText, point, edge): number | null`. A point outside every block moves to the next block's start (start edge) or the previous block's end (end edge); a point in a whole-block-only block moves to that block's edge.
  - `rangeForPassage(container, documentText, startOffset, endOffset): Range | null`. The range covers the passage's text, or the whole of a whole-block-only block; mapping it back with `offsetInDocument` gives the same offsets for every block of the conformance corpus.
  - `passageAnchor(documentText, documentPath, startOffset, endOffset): NewPassageAnchor`, with up to 32 characters of context either side.
  - `selectedPassage(container, documentText, documentPath, selection: Range): NewPassageAnchor | null`. It trims whitespace at either end, and gives null when the selection holds no text of the doc.
  - `offsetAtPoint(container, documentText, x, y): number | null`, via `caretPositionFromPoint`, or `caretRangeFromPoint` where that is missing.
  - Test helper `mountDocument(source): Promise<MountedDocument>` (`{ container, documentText, pointAt(text, after?) }`).

- [ ] **Step 1: Write the failing tests**

The tests render docs with the real pipeline into jsdom and build selections with DOM ranges. The round-trip test runs every block of plan 1's conformance corpus through `rangeForPassage` and back:

`src/web/testing/mountDocument.ts`:

````ts
import { createDocumentText } from "../../shared/markdown/createDocumentText";
import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { PagePoint } from "../anchoring/PagePoint";
import { renderDocument } from "../rendering/renderDocument";

export interface MountedDocument {
  container: HTMLElement;
  documentText: DocumentText;

  /**
   * The point just before the first occurrence of `text` in the page, or after it when `after` is set
   */
  pointAt: (text: string, after?: boolean) => PagePoint;
}

/**
 * Renders `docs/plan.md` with the given source into the page, the way the review page does
 */
export async function mountDocument(source: string): Promise<MountedDocument> {
  const container = document.createElement("article");
  container.innerHTML = await renderDocument(source, "docs/plan.md");
  document.body.replaceChildren(container);
  const pointAt = (text: string, after = false): PagePoint => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
      const index = node.textContent?.indexOf(text) ?? -1;
      if (index !== -1) {
        return { node, offset: after ? index + text.length : index };
      }
    }
    throw new Error(`The page has no text "${text}"`);
  };
  return { container, documentText: createDocumentText(source), pointAt };
}
````

`src/web/anchoring/selectedPassage.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { mountDocument } from "../testing/mountDocument";

import type { PagePoint } from "./PagePoint";
import { selectedPassage } from "./selectedPassage";

const source = [
  "# Plan",
  "",
  "We cache results for **24h** today.",
  "",
  "Retries happen three times.",
  "",
  "| Setting | Value |",
  "| --- | --- |",
  "| ttl | `3600` |",
  "",
  "<div>",
  "Raw HTML",
  "</div>",
  "",
].join("\n");

describe("selectedPassage", () => {
  test("must anchor to the canonical text the user selected when the selection crosses inline markup", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("cache"), pointAt("24h", true))
    );

    expect(anchor).toEqual({
      document: "docs/plan.md",
      endOffset: 29,
      kind: "passage",
      prefix: "Plan\nWe ",
      quote: "cache results for 24h",
      startOffset: 8,
      suffix: " today.\nRetries happen three tim",
    });
  });

  test("must join the blocks' text with a line break when the selection spans two paragraphs", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("24h"), pointAt("Retries", true))
    );

    expect(anchor?.quote).toBe("24h today.\nRetries");
  });

  test("must leave out the line break after a paragraph when the user selects the whole paragraph", async () => {
    const { container, documentText } = await mountDocument(source);
    const paragraph = container.querySelector('[data-md-block="1"]') ?? container;
    const nextParagraph = container.querySelector('[data-md-block="2"]') ?? container;

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select({ node: paragraph, offset: 0 }, { node: nextParagraph, offset: 0 })
    );

    expect(anchor?.quote).toBe("We cache results for 24h today.");
  });

  test("must start at the next block when the selection starts between blocks", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const between = container.querySelector("h1")?.nextSibling ?? container;

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select({ node: between, offset: 0 }, pointAt("We", true))
    );

    expect(anchor?.quote).toBe("We");
  });

  test("must separate the cells with a tab when the selection spans a table row", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("ttl"), pointAt("3600", true))
    );

    expect(anchor?.quote).toBe("ttl\t3600");
  });

  test("must take in the whole block when the selection ends inside a block that takes whole-block comments only", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("3600"), pointAt("Raw", true))
    );

    expect(anchor?.quote).toBe("3600\n<div>\nRaw HTML\n</div>");
  });

  test("must not count the app's own controls when a block holds one", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const marker = document.createElement("button");
    marker.setAttribute("data-md-ignore", "");
    marker.textContent = "#1";
    container.querySelector("p")?.prepend(marker);

    const anchor = selectedPassage(
      container,
      documentText,
      "docs/plan.md",
      select(pointAt("cache"), pointAt("cache", true))
    );

    expect(anchor).toMatchObject({ endOffset: 13, quote: "cache", startOffset: 8 });
  });

  test.each([
    { condition: "nothing is selected", start: "cache", end: "cache" },
    { condition: "only the space between two words is selected", start: " results", end: "results" },
  ])("must give no anchor when $condition", async ({ end, start }) => {
    const { container, documentText, pointAt } = await mountDocument(source);

    expect(selectedPassage(container, documentText, "docs/plan.md", select(pointAt(start), pointAt(end)))).toBeNull();
  });
});

function select(start: PagePoint, end: PagePoint): Range {
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}
````

`src/web/anchoring/rangeForPassage.test.ts`:

````ts
import { describe, expect, test } from "vitest";

import { parseBlocks } from "../../shared/markdown/parseBlocks";
import conformanceCorpus from "../rendering/testing/conformanceCorpus.md?raw";
import { mountDocument } from "../testing/mountDocument";

import { offsetInDocument } from "./offsetInDocument";
import { rangeForPassage } from "./rangeForPassage";

const source =
  "# Plan\n\nWe cache results for **24h** today.\n\nRetries happen three times.\n\n<div>\nRaw HTML\n</div>\n";

const corpusBlocks = parseBlocks(conformanceCorpus)
  .map((block, index) => ({ ...block, index }))
  .filter((block) => !block.wholeBlockOnly);

describe("rangeForPassage", () => {
  test("must cover exactly the passage's text when the passage crosses inline markup", async () => {
    const { container, documentText } = await mountDocument(source);
    const start = documentText.text.indexOf("cache");

    const range = rangeForPassage(container, documentText, start, start + "cache results for 24h".length);

    expect(range?.toString()).toBe("cache results for 24h");
  });

  test("must run from one block into the next when the passage spans two paragraphs", async () => {
    const { container, documentText } = await mountDocument(source);
    const start = documentText.text.indexOf("24h");

    const range = rangeForPassage(container, documentText, start, start + "24h today.\nRetries".length);

    expect(range?.toString()).toBe("24h today.\nRetries");
  });

  test("must cover the whole block when the passage is in a block that takes whole-block comments only", async () => {
    const { container, documentText } = await mountDocument(source);
    const start = documentText.text.indexOf("<div>");

    const range = rangeForPassage(container, documentText, start, start + 5);

    expect(range?.toString()).toBe(container.querySelector('[data-md-block="3"]')?.textContent);
  });

  test.each(corpusBlocks)(
    "must map block $index back to the same offsets when it is found in the page",
    async ({ index }) => {
      const { container, documentText } = await mountDocument(conformanceCorpus);
      const start = documentText.blockStartOffsets[index] ?? 0;
      const end = start + (documentText.blocks[index]?.text.length ?? 0);

      const range = rangeForPassage(container, documentText, start, end);

      const startPoint = { node: range?.startContainer as Node, offset: range?.startOffset ?? 0 };
      const endPoint = { node: range?.endContainer as Node, offset: range?.endOffset ?? 0 };
      expect([
        offsetInDocument(container, documentText, startPoint, "start"),
        offsetInDocument(container, documentText, endPoint, "end"),
      ]).toEqual([start, end]);
    }
  );
});
````

`src/web/anchoring/offsetAtPoint.test.ts`:

````ts
import { afterEach, describe, expect, test, vi } from "vitest";

import { mountDocument } from "../testing/mountDocument";

import { offsetAtPoint } from "./offsetAtPoint";

const source = "# Plan\n\nWe cache results for 24h.\n";

afterEach(() => {
  Reflect.deleteProperty(document, "caretPositionFromPoint");
  Reflect.deleteProperty(document, "caretRangeFromPoint");
});

describe("offsetAtPoint", () => {
  test("must find the character under the point when the browser reports a caret position", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const { node, offset } = pointAt("results");
    Object.assign(document, { caretPositionFromPoint: vi.fn(() => ({ offset, offsetNode: node })) });

    expect(offsetAtPoint(container, documentText, 120, 40)).toBe(documentText.text.indexOf("results"));
  });

  test("must find the character under the point when the browser only reports a caret range", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const caret = document.createRange();
    caret.setStart(pointAt("24h").node, pointAt("24h").offset);
    Object.assign(document, { caretRangeFromPoint: vi.fn(() => caret) });

    expect(offsetAtPoint(container, documentText, 120, 40)).toBe(documentText.text.indexOf("24h"));
  });

  test("must find nothing when the point is outside the doc", async () => {
    const { container, documentText } = await mountDocument(source);
    const outside = document.createElement("p");
    outside.textContent = "Sidebar";
    document.body.append(outside);
    Object.assign(document, { caretPositionFromPoint: vi.fn(() => ({ offset: 0, offsetNode: outside.firstChild })) });

    expect(offsetAtPoint(container, documentText, 900, 40)).toBeNull();
  });
});
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project web src/web/anchoring`
Expected: FAIL, the three files with `Failed to resolve import "./selectedPassage"`, `"./rangeForPassage"` and `"./offsetAtPoint"`.

- [ ] **Step 3: Write the mapping**

Points inside a block go through plan 1's text walk, so they skip `data-md-ignore` elements and count a table row's cells with tabs between; points outside blocks are compared with `Range.comparePoint`:

`src/web/anchoring/PagePoint.ts`:

````ts
/**
 * A boundary point in the rendered page, as a DOM Range gives one
 */
export interface PagePoint {
  node: Node;
  offset: number;
}
````

`src/web/anchoring/blockElementAt.ts`:

````ts
/**
 * Finds the rendered block a node is in
 *
 * @param container the element the rendered doc was inserted into
 * @param node a node of the page
 * @returns the element carrying the block's `data-md-block`, or null when the node is in no block of the container
 */
export function blockElementAt(container: Element, node: Node): Element | null {
  const element = node instanceof Element ? node : node.parentElement;
  const blockElement = element?.closest("[data-md-block]") ?? null;
  return blockElement !== null && container.contains(blockElement) ? blockElement : null;
}
````

`src/web/anchoring/offsetInDocument.ts`:

````ts
import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { BlockTextLayout } from "../rendering/BlockTextLayout";
import { layOutBlockText } from "../rendering/layOutBlockText";

import { blockElementAt } from "./blockElementAt";
import type { PagePoint } from "./PagePoint";

/**
 * Which end of a passage a point is
 */
export type PassageEdge = "start" | "end";

/**
 * Finds where a point in a rendered doc falls in the doc's canonical text
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param point the point, as a DOM Range or caret gives it
 * @param edge which end of a passage the point is: a point outside every block moves forward to the next block's start
 *   when it starts a passage, and back to the previous block's end when it ends one, and a point in a block that takes
 *   whole-block comments only moves to that block's start or end the same way
 * @returns the offset in the canonical text, or null when no block lies in that direction
 */
export function offsetInDocument(
  container: Element,
  documentText: DocumentText,
  { node, offset }: PagePoint,
  edge: PassageEdge
): number | null {
  const element = blockElementAt(container, node);
  const blockElement = element ?? nearestBlockElement(container, { node, offset }, edge);
  if (blockElement === undefined) {
    return null;
  }
  const index = Number(blockElement.getAttribute("data-md-block"));
  const block = documentText.blocks[index];
  const blockStart = documentText.blockStartOffsets[index];
  if (block === undefined || blockStart === undefined) {
    return null;
  }
  if (element === null || block.wholeBlockOnly) {
    return edge === "start" ? blockStart : blockStart + block.text.length;
  }
  return blockStart + offsetInBlock(container.ownerDocument, layOutBlockText(blockElement), { node, offset });
}

function nearestBlockElement(container: Element, point: PagePoint, edge: PassageEdge): Element | undefined {
  const pointRange = container.ownerDocument.createRange();
  pointRange.setStart(point.node, point.offset);
  const blockElements = [...container.querySelectorAll("[data-md-block]")];
  return edge === "start"
    ? blockElements.find((element) => pointRange.comparePoint(element, 0) >= 0)
    : blockElements.findLast((element) => pointRange.comparePoint(element, element.childNodes.length) <= 0);
}

function offsetInBlock(document: Document, layout: BlockTextLayout, { node, offset }: PagePoint): number {
  const segment = layout.segments.find((candidate) => candidate.node === node);
  if (segment !== undefined) {
    return segment.offset + Math.min(offset, segment.node.length);
  }
  const pointRange = document.createRange();
  pointRange.setStart(node, offset);
  const next = layout.segments.find((candidate) => pointRange.comparePoint(candidate.node, 0) >= 0);
  return next?.offset ?? layout.text.length;
}
````

`src/web/anchoring/passageAnchor.ts`:

````ts
import type { DocumentText } from "../../shared/markdown/DocumentText";
import { contextLength } from "../../shared/review/anchorSchema";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

/**
 * Builds the anchor a new comment on a passage of a doc's canonical text sends to the server
 *
 * @param documentText the doc's canonical text
 * @param documentPath the doc's repo-relative path
 * @param startOffset where the passage starts
 * @param endOffset where it ends, exclusive
 * @returns the anchor, with up to 32 characters of context either side
 */
export function passageAnchor(
  documentText: DocumentText,
  documentPath: string,
  startOffset: number,
  endOffset: number
): NewPassageAnchor {
  const { text } = documentText;
  return {
    document: documentPath,
    endOffset,
    kind: "passage",
    prefix: text.slice(Math.max(0, startOffset - contextLength), startOffset),
    quote: text.slice(startOffset, endOffset),
    startOffset,
    suffix: text.slice(endOffset, endOffset + contextLength),
  };
}
````

`src/web/anchoring/selectedPassage.ts`:

````ts
import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import { offsetInDocument } from "./offsetInDocument";
import { passageAnchor } from "./passageAnchor";

/**
 * Turns the user's selection in a rendered doc into the anchor of a new comment
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param documentPath the doc's repo-relative path
 * @param selection the selected range
 * @returns the anchor of the selected text without whitespace at either end, or null when the selection holds no
 *   text of the doc
 */
export function selectedPassage(
  container: Element,
  documentText: DocumentText,
  documentPath: string,
  selection: Range
): NewPassageAnchor | null {
  if (selection.collapsed || !selection.intersectsNode(container)) {
    return null;
  }
  const start = { node: selection.startContainer, offset: selection.startOffset };
  const end = { node: selection.endContainer, offset: selection.endOffset };
  let startOffset = offsetInDocument(container, documentText, start, "start");
  let endOffset = offsetInDocument(container, documentText, end, "end");
  if (startOffset === null || endOffset === null) {
    return null;
  }
  const { text } = documentText;
  while (startOffset < endOffset && /\s/.test(text.charAt(startOffset))) {
    startOffset += 1;
  }
  while (endOffset > startOffset && /\s/.test(text.charAt(endOffset - 1))) {
    endOffset -= 1;
  }
  return startOffset === endOffset ? null : passageAnchor(documentText, documentPath, startOffset, endOffset);
}
````

`src/web/anchoring/rangeForPassage.ts`:

````ts
import { blockAtOffset } from "../../shared/markdown/blockAtOffset";
import type { DocumentText } from "../../shared/markdown/DocumentText";
import { layOutBlockText } from "../rendering/layOutBlockText";

import type { PassageEdge } from "./offsetInDocument";
import type { PagePoint } from "./PagePoint";

/**
 * Finds the part of a rendered doc that a passage of its canonical text covers
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param startOffset where the passage starts in the canonical text
 * @param endOffset where it ends, exclusive
 * @returns a range over the passage's text, which covers the whole of any block that takes whole-block comments only,
 *   or null when the doc has no blocks
 */
export function rangeForPassage(
  container: Element,
  documentText: DocumentText,
  startOffset: number,
  endOffset: number
): Range | null {
  const start = pointAt(container, documentText, startOffset, "start");
  const end = pointAt(container, documentText, Math.max(startOffset, endOffset - 1), "end");
  if (start === null || end === null) {
    return null;
  }
  const range = container.ownerDocument.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  return range;
}

/**
 * @param offset for the start edge, the first character of the passage; for the end edge, its last character
 */
function pointAt(container: Element, documentText: DocumentText, offset: number, edge: PassageEdge): PagePoint | null {
  const position = blockAtOffset(documentText, offset);
  const index = position === null ? -1 : documentText.blocks.indexOf(position.block);
  const element = container.querySelector(`[data-md-block="${index}"]`);
  if (position === null || element === null) {
    return null;
  }
  const atBlockEdge =
    edge === "start" ? { node: element, offset: 0 } : { node: element, offset: element.childNodes.length };
  if (position.block.wholeBlockOnly) {
    return atBlockEdge;
  }
  const { segments } = layOutBlockText(element);
  const characterOffset = position.offsetInBlock;
  const segment =
    edge === "start"
      ? segments.find((candidate) => characterOffset < candidate.offset + candidate.node.length)
      : segments.findLast((candidate) => characterOffset >= candidate.offset);
  if (segment === undefined) {
    return atBlockEdge;
  }
  const offsetInNode = characterOffset - segment.offset + (edge === "start" ? 0 : 1);
  return { node: segment.node, offset: Math.min(Math.max(offsetInNode, 0), segment.node.length) };
}
````

`src/web/anchoring/offsetAtPoint.ts`:

````ts
import type { DocumentText } from "../../shared/markdown/DocumentText";

import { offsetInDocument } from "./offsetInDocument";
import type { PagePoint } from "./PagePoint";

/**
 * Finds the character of a rendered doc under a point on the screen, as a click on a highlight gives it
 *
 * @param container the element the rendered doc was inserted into
 * @param documentText the canonical text of the doc that was rendered
 * @param x the point's distance from the viewport's left edge
 * @param y its distance from the viewport's top edge
 * @returns the offset in the canonical text, or null when the point is on no text of the doc
 */
export function offsetAtPoint(container: Element, documentText: DocumentText, x: number, y: number): number | null {
  const caret = caretAt(container.ownerDocument, x, y);
  if (caret === null || !container.contains(caret.node)) {
    return null;
  }
  return offsetInDocument(container, documentText, caret, "start");
}

function caretAt(document: Document, x: number, y: number): PagePoint | null {
  if (typeof document.caretPositionFromPoint === "function") {
    const position = document.caretPositionFromPoint(x, y);
    return position === null ? null : { node: position.offsetNode, offset: position.offset };
  }
  // Safari before 26.2 has only the older call
  const range = document.caretRangeFromPoint(x, y);
  return range === null ? null : { node: range.startContainer, offset: range.startOffset };
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project web src/web/anchoring`
Expected: PASS, 38 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 435 tests; fallow `warn`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Map between positions in the rendered page and the doc's canonical text"
```

---

### Task 6: The thread card

**Files:**
- Create: `src/web/api/ReviewApiContext.ts`, `src/web/api/useReviewApi.ts`, `src/web/api/describeFailure.ts`, `src/web/review/describeLocation.ts`, `src/web/components/Quote/Quote.tsx`, `src/web/components/Quote/Quote.module.css`, `src/web/components/CommentForm/CommentForm.tsx`, `src/web/components/ThreadCard/ThreadActions.tsx`, `src/web/components/ThreadCard/ThreadCard.tsx`, `src/web/components/ThreadCard/ThreadCard.module.css`, `src/web/testing/createFakeReviewApi.ts`, `src/web/testing/standInForLayout.ts`
- Modify: `package.json`, `src/web/testing/setup.ts`
- Test: `src/web/components/ThreadCard/ThreadCard.test.tsx`

**Interfaces:**
- Consumes:
  - `ReviewApi`, `ReviewApiError` (Task 3); `Thread`, `Anchor` (plan 1); `buildThread`, `buildPassageAnchor`, `testTime` (plan 1 test builders); `createDocumentText`, `linesForRange` (plan 1).
- Produces:
  - `ReviewApiContext` (`createContext<ReviewApi | null>`) and `useReviewApi(): ReviewApi`, which throws without a provider.
  - `describeFailure(failure: unknown): string`, the message shown for a refused request.
  - `describeLocation(anchor: Anchor): string`: "Line 3", "Lines 12–13", "Whole doc" or "Whole review".
  - `<Quote text>`: the quoted text, cut short after four lines.
  - `<CommentForm children? clearOnSubmit initialBody label onCancel? onSubmit shouldFocus submitLabel>`. `onSubmit(body): Promise<void>`; a rejection shows as an alert and keeps the text, and Save is disabled while the text is blank or unchanged.
  - `<ThreadCard hasNewAgentMessage isSelected onChanged onSelect thread>`, an `article` named "Thread #N".
    - It holds the passage, with "Originally: …" when the anchor moved, the messages as an `ol` named "Messages", and the "New", "Outdated" and "Resolved" badges.
    - Its location button reads "#N Line 3".
    - `ThreadActions` handles the thread's draft: "Save draft" and "Discard draft" for a draft, "Reply" and "Save reply" otherwise, and "Resolve" for an open thread. It calls `onChanged` after each change.
    - The card scrolls into view when it becomes selected.
  - Test helper `createFakeReviewApi({ documents?, recent?, threads? }): FakeReviewApi`, which returns `{ api, emit(event), snapshot }`. Each method of `api` is a `vi.fn` over an in-memory server that keeps threads the way the real one does and emits `threads-changed` after each change.
  - `src/web/testing/standInForLayout.ts`, which stands in for `Element.prototype.scrollIntoView`; Tasks 9 and 10 extend it.

- [ ] **Step 1: Install the user-event library and clsx**

```bash
pnpm add -D @testing-library/user-event clsx
pnpm format
```

- [ ] **Step 2: Write the failing tests and their fake server**

jsdom cannot scroll, and the card scrolls itself into view when selected:

`src/web/testing/standInForLayout.ts`:

````ts
// jsdom lays nothing out, so it cannot scroll; this stand-in lets components that scroll an element into view run
Element.prototype.scrollIntoView = () => {};
````

`src/web/testing/setup.ts`:

````ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "./standInForLayout";

// Testing Library only cleans up automatically when Vitest globals are on
afterEach(() => {
  cleanup();
});
````

The fake implements the browser routes in memory, so tests can check what the server ended up holding rather than which calls were made:

`src/web/testing/createFakeReviewApi.ts`:

````ts
import type { Mock } from "vitest";
import { vi } from "vitest";

import type { DocumentCount, ThreadsSnapshot } from "../../shared/api/apiResponseSchemas";
import { createDocumentText } from "../../shared/markdown/createDocumentText";
import { linesForRange } from "../../shared/markdown/linesForRange";
import type { Anchor } from "../../shared/review/anchorSchema";
import type { NewThread } from "../../shared/review/newThreadSchema";
import type { Thread } from "../../shared/review/threadSchema";
import type { ReviewApi } from "../api/ReviewApi";
import { ReviewApiError } from "../api/ReviewApiError";
import type { ReviewEvent } from "../api/reviewEventSchema";

const testDocument = "# Plan\n\nWe cache results for **24h** today.\n\nRetries happen three times.\n";

export interface FakeReviewApiOptions {
  documents?: Record<string, string>;
  recent?: string[];
  threads?: Thread[];
}

export interface FakeReviewApi {
  /**
   * The API to give the code under test; every method is a spy over an in-memory server
   */
  api: { [Method in keyof ReviewApi]: Mock<ReviewApi[Method]> };

  /**
   * Sends an event to every listener, as the server's event stream does
   */
  emit(event: ReviewEvent): void;

  /**
   * What the in-memory server holds; a test may change it before it emits `threads-changed`
   */
  snapshot: ThreadsSnapshot;
}

/**
 * Creates a review API over an in-memory server holding `docs/plan.md`, which keeps threads the way the real server
 * does and announces every change to its listeners
 */
export function createFakeReviewApi({
  documents = { "docs/plan.md": testDocument },
  recent = [],
  threads = [],
}: FakeReviewApiOptions = {}): FakeReviewApi {
  const snapshot: ThreadsSnapshot = {
    problems: [],
    review: { approved: false, approvedAt: null, requestedAt: "2026-10-08T09:00:00.000Z" },
    threads: structuredClone(threads),
  };
  const listeners = new Set<(event: ReviewEvent) => void>();
  const emit = (event: ReviewEvent): void => {
    for (const listener of listeners) {
      listener(event);
    }
  };
  const change = (id: number, update: (thread: Thread, at: string) => Thread | null): Promise<void> => {
    const thread = snapshot.threads.find((candidate) => candidate.id === id);
    if (thread === undefined) {
      return Promise.reject(new ReviewApiError(404, "unknown-thread", `No thread #${id}`));
    }
    const updated = update(thread, new Date().toISOString());
    snapshot.threads = snapshot.threads.flatMap((candidate) => {
      if (candidate.id !== id) {
        return [candidate];
      }
      return updated === null ? [] : [updated];
    });
    emit({ type: "threads-changed" });
    return Promise.resolve();
  };
  const api: ReviewApi = {
    createThread: ({ anchor, body }) => {
      const at = new Date().toISOString();
      const id = Math.max(0, ...snapshot.threads.map((thread) => thread.id)) + 1;
      const threadAnchor = toThreadAnchor(anchor, documents);
      snapshot.threads.push({
        anchor: threadAnchor,
        createdAt: at,
        draft: { at, body },
        id,
        messages: [],
        status: "draft",
        updatedAt: at,
      });
      emit({ type: "threads-changed" });
      return Promise.resolve();
    },
    deleteDraft: (id) => change(id, ({ draft: _draft, ...thread }) => (thread.status === "draft" ? null : thread)),
    readDocument: (document) => {
      const source = documents[document];
      return source === undefined
        ? Promise.reject(new ReviewApiError(404, "missing-document", `${document} does not exist`))
        : Promise.resolve({ hash: `hash of ${document}`, path: document, source });
    },
    readDocuments: () => Promise.resolve({ documents: countByDocument(snapshot.threads), problems: [], recent }),
    readThreads: () => Promise.resolve(structuredClone(snapshot)),
    resolveThread: (id) => change(id, (thread, at) => ({ ...thread, status: "resolved", updatedAt: at })),
    submit: (verdict) => {
      const at = new Date().toISOString();
      snapshot.threads = snapshot.threads.map(({ draft, ...thread }) =>
        draft === undefined
          ? { ...thread }
          : {
              ...thread,
              messages: [...thread.messages, { at, author: "user", body: draft.body }],
              status: "open",
              updatedAt: at,
            }
      );
      snapshot.review = {
        ...snapshot.review,
        approved: verdict === "approve",
        approvedAt: verdict === "approve" ? at : null,
      };
      emit({ type: "threads-changed" });
      return Promise.resolve();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    writeDraft: (id, body) => change(id, (thread, at) => ({ ...thread, draft: { at, body }, updatedAt: at })),
  };
  return {
    api: {
      createThread: vi.fn(api.createThread),
      deleteDraft: vi.fn(api.deleteDraft),
      readDocument: vi.fn(api.readDocument),
      readDocuments: vi.fn(api.readDocuments),
      readThreads: vi.fn(api.readThreads),
      resolveThread: vi.fn(api.resolveThread),
      submit: vi.fn(api.submit),
      subscribe: vi.fn(api.subscribe),
      writeDraft: vi.fn(api.writeDraft),
    },
    emit,
    snapshot,
  };
}

function toThreadAnchor(anchor: NewThread["anchor"], documents: Record<string, string>): Anchor {
  if (anchor.kind !== "passage") {
    return anchor;
  }
  const documentText = createDocumentText(documents[anchor.document] ?? "");
  const lines = linesForRange(documentText, anchor.startOffset, anchor.endOffset);
  return { ...anchor, ...lines, anchoredText: anchor.quote, outdated: false };
}

function countByDocument(threads: readonly Thread[]): DocumentCount[] {
  const counts = new Map<string, DocumentCount>();
  for (const thread of threads) {
    if (thread.anchor.kind !== "review") {
      const count = counts.get(thread.anchor.document) ?? {
        document: thread.anchor.document,
        draftCount: 0,
        openCount: 0,
      };
      counts.set(thread.anchor.document, {
        ...count,
        draftCount: count.draftCount + (thread.draft === undefined ? 0 : 1),
        openCount: count.openCount + (thread.status === "open" ? 1 : 0),
      });
    }
  }
  return [...counts.values()];
}
````

`src/web/components/ThreadCard/ThreadCard.test.tsx`:

````tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadCard } from "./ThreadCard";

const conversation = buildThread({
  anchor: buildPassageAnchor(),
  messages: [
    { at: testTime, author: "user", body: "Why 24h?" },
    { at: "2026-10-08T09:05:00.000Z", author: "agent", body: "Upstream data changes daily." },
  ],
});

describe("ThreadCard", () => {
  test("must show the passage and who wrote each message when the thread has a conversation", () => {
    const { render } = setUpTest({ thread: conversation });

    render();

    const [question, answer] = within(screen.getByRole("list", { name: "Messages" })).getAllByRole("listitem");
    expect(screen.getByText("cache results for 24h")).toBeInTheDocument();
    expect(question).toHaveTextContent("You Why 24h?");
    expect(answer).toHaveTextContent("Agent Upstream data changes daily.");
  });

  test("must show the text the user chose as well when an edit moved the passage onto other text", () => {
    const { render } = setUpTest({
      thread: buildThread({ anchor: buildPassageAnchor({ anchoredText: "cache results for 1h" }) }),
    });

    render();

    expect(screen.getByText("Originally: cache results for 24h")).toBeInTheDocument();
  });

  test("must save the reply as a draft when the user replies", async () => {
    const { fake, onChanged, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save reply"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Hourly, then");
    expect(onChanged).toHaveBeenCalled();
  });

  test("must save the user's changes when the user edits a draft", async () => {
    const draft = buildThread({ draft: { at: testTime, body: "Why 24h?" }, messages: [], status: "draft" });
    const { fake, render } = setUpTest({ thread: draft });
    const user = userEvent.setup();
    render();

    await user.type(elements.textbox("Draft comment"), " And why cache?");
    await user.click(elements.button("Save draft"));

    expect(fake.snapshot.threads[0]?.draft?.body).toBe("Why 24h? And why cache?");
  });

  test("must delete a new comment when the user discards its draft", async () => {
    const draft = buildThread({ draft: { at: testTime, body: "Why 24h?" }, messages: [], status: "draft" });
    const { fake, render } = setUpTest({ thread: draft });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Discard draft"));

    expect(fake.snapshot.threads).toEqual([]);
  });

  test("must resolve the thread when the user resolves it", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Resolve"));

    expect(fake.snapshot.threads[0]?.status).toBe("resolved");
  });

  test("must offer only a reply when the thread is already resolved", () => {
    const { render } = setUpTest({ thread: { ...conversation, status: "resolved" } });

    render();

    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
  });

  test("must show why and keep the text when the server refuses the reply", async () => {
    const { fake, render } = setUpTest({ thread: conversation });
    fake.api.writeDraft.mockRejectedValueOnce(new ReviewApiError(409, "invalid-file", "review.json is not valid"));
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "Hourly, then");
    await user.click(elements.button("Save reply"));

    expect(await screen.findByRole("alert")).toHaveTextContent("review.json is not valid");
    expect(elements.textbox("Reply")).toHaveValue("Hourly, then");
  });

  test("must not let the user save a reply when it is blank", async () => {
    const { render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("Reply"));
    await user.type(elements.textbox("Reply"), "   ");

    expect(elements.button("Save reply")).toBeDisabled();
  });

  test("must ask to show the thread in its doc when the user clicks where it is", async () => {
    const { onSelect, render } = setUpTest({ thread: conversation });
    const user = userEvent.setup();
    render();

    await user.click(elements.button("#1 Line 3"));

    expect(onSelect).toHaveBeenCalledWith(conversation);
  });

  test("must mark the thread when the agent has written since the user last viewed it", () => {
    const { render } = setUpTest({ hasNewAgentMessage: true, thread: conversation });

    render();

    expect(screen.getByText("New")).toBeInTheDocument();
  });
});

function setUpTest({ hasNewAgentMessage = false, thread }: { hasNewAgentMessage?: boolean; thread: Thread }) {
  const fake = createFakeReviewApi({ threads: [thread] });
  const onChanged = vi.fn();
  const onSelect = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ThreadCard
          hasNewAgentMessage={hasNewAgentMessage}
          isSelected={false}
          onChanged={onChanged}
          onSelect={onSelect}
          thread={thread}
        />
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onSelect, render };
}

const elements = {
  button: (name: string) => screen.getByRole("button", { name }),
  textbox: (name: string) => screen.getByRole("textbox", { name }),
};
````

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run --project web src/web/components/ThreadCard`
Expected: FAIL with `Failed to resolve import "../../api/ReviewApiContext"`.

- [ ] **Step 4: Write the card**

`src/web/api/ReviewApiContext.ts`:

````ts
import { createContext } from "react";

import type { ReviewApi } from "./ReviewApi";

export const ReviewApiContext = createContext<ReviewApi | null>(null);
````

`src/web/api/useReviewApi.ts`:

````ts
import { useContext } from "react";

import type { ReviewApi } from "./ReviewApi";
import { ReviewApiContext } from "./ReviewApiContext";

/**
 * Gives a component the review server's API
 *
 * @returns the API
 * @throws when no ReviewApiContext surrounds the component
 */
export function useReviewApi(): ReviewApi {
  const api = useContext(ReviewApiContext);
  if (api === null) {
    throw new Error("useReviewApi needs a ReviewApiContext around the component");
  }
  return api;
}
````

`src/web/api/describeFailure.ts`:

````ts
/**
 * @param failure what a request to the server rejected with
 * @returns a message to show the user
 */
export function describeFailure(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}
````

`src/web/review/describeLocation.ts`:

````ts
import type { Anchor } from "../../shared/review/anchorSchema";

/**
 * Says where in its doc a thread is, for the sidebar
 *
 * @param anchor what the thread is on
 * @returns "Line 3", "Lines 12–13", "Whole doc" or "Whole review"
 */
export function describeLocation(anchor: Anchor): string {
  switch (anchor.kind) {
    case "review":
      return "Whole review";
    case "document":
      return "Whole doc";
    case "passage":
      return anchor.startLine === anchor.endLine
        ? `Line ${anchor.startLine}`
        : `Lines ${anchor.startLine}–${anchor.endLine}`;
  }
}
````

`src/web/components/Quote/Quote.tsx`:

````tsx
import type { JSX } from "react";

import styles from "./Quote.module.css";

export interface QuoteProps {
  /**
   * The doc's text that a comment is on
   */
  text: string;
}

/**
 * The text a comment is on, cut short after a few lines
 */
export function Quote({ text }: QuoteProps): JSX.Element {
  return <blockquote className={styles.quote}>{text}</blockquote>;
}
````

`src/web/components/Quote/Quote.module.css`:

````css
.quote {
  border-inline-start: 3px solid var(--sui-color-warning);
  color: var(--sui-color-text-muted);
  display: -webkit-box;
  font-size: var(--sui-font-size-sm);
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
  padding-inline-start: var(--sui-space-2);
  white-space: pre-wrap;
}
````

`src/web/components/CommentForm/CommentForm.tsx`:

````tsx
import { Alert, Button, Cluster, Field, Stack, Textarea } from "@krelborn/stylesui";
import type { FormEvent, JSX, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { describeFailure } from "../../api/describeFailure";

export interface CommentFormProps {
  /**
   * Further actions shown after the submit button, such as discarding a draft
   */
  children?: ReactNode;

  /**
   * Whether the text box empties once the text is saved, ready for another comment
   */
  clearOnSubmit: boolean;

  initialBody: string;
  label: string;
  onCancel?: () => void;

  /**
   * Saves the text; when it rejects, the form shows the error and keeps the text
   */
  onSubmit: (body: string) => Promise<void>;

  /**
   * Whether the text box takes focus when the form appears
   */
  shouldFocus: boolean;

  submitLabel: string;
}

/**
 * A text box for a comment, a reply or a draft, with the button that saves it
 */
export function CommentForm({
  children,
  clearOnSubmit,
  initialBody,
  label,
  onCancel,
  onSubmit,
  shouldFocus,
  submitLabel,
}: CommentFormProps): JSX.Element {
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (shouldFocus) {
      textareaRef.current?.focus();
    }
  }, [shouldFocus]);
  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await onSubmit(body);
      setError(null);
      if (clearOnSubmit) {
        setBody("");
      }
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <Stack as="form" gap={2} onSubmit={(event: FormEvent) => void submit(event)}>
      <Field label={label}>
        <Textarea onChange={(event) => setBody(event.target.value)} ref={textareaRef} rows={3} value={body} />
      </Field>
      {error !== null && (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      )}
      <Cluster gap={2}>
        <Button busy={isSaving} disabled={body.trim() === "" || body === initialBody} size="sm" type="submit">
          {submitLabel}
        </Button>
        {onCancel !== undefined && (
          <Button onClick={onCancel} size="sm" variant="ghost">
            Cancel
          </Button>
        )}
        {children}
      </Cluster>
    </Stack>
  );
}
````

The draft, reply and resolve actions live in `ThreadActions`, which keeps `ThreadCard` under fallow's complexity limit:

`src/web/components/ThreadCard/ThreadActions.tsx`:

````tsx
import { Alert, Button, Cluster } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { CommentForm } from "../CommentForm/CommentForm";

export interface ThreadActionsProps {
  /**
   * Called after an action changes the thread on the server
   */
  onChanged: () => void;

  thread: Thread;
}

/**
 * What the user can do with a thread: edit or discard their draft, start a reply, or resolve it
 */
export function ThreadActions({ onChanged, thread }: ThreadActionsProps): JSX.Element {
  const api = useReviewApi();
  const [isReplying, setIsReplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { draft, id, status } = thread;
  const run = async (action: () => Promise<void>): Promise<void> => {
    try {
      await action();
      setError(null);
      onChanged();
    } catch (failure) {
      setError(describeFailure(failure));
    }
  };
  const saveDraft = async (body: string): Promise<void> => {
    await api.writeDraft(id, body);
    setIsReplying(false);
    onChanged();
  };
  const refusal = error !== null && (
    <Alert role="alert" tone="danger">
      {error}
    </Alert>
  );
  if (draft !== undefined) {
    return (
      <CommentForm
        clearOnSubmit={false}
        initialBody={draft.body}
        label={status === "draft" ? "Draft comment" : "Draft reply"}
        onSubmit={saveDraft}
        shouldFocus={false}
        submitLabel="Save draft"
      >
        <Button onClick={() => void run(() => api.deleteDraft(id))} size="sm" variant="ghost">
          Discard draft
        </Button>
        {refusal}
      </CommentForm>
    );
  }
  if (isReplying) {
    return (
      <CommentForm
        clearOnSubmit={false}
        initialBody=""
        label="Reply"
        onCancel={() => setIsReplying(false)}
        onSubmit={saveDraft}
        shouldFocus={true}
        submitLabel="Save reply"
      />
    );
  }
  return (
    <Cluster gap={2}>
      <Button onClick={() => setIsReplying(true)} size="sm" variant="secondary">
        Reply
      </Button>
      {status === "open" && (
        <Button onClick={() => void run(() => api.resolveThread(id))} size="sm" variant="outline">
          Resolve
        </Button>
      )}
      {refusal}
    </Cluster>
  );
}
````

`src/web/components/ThreadCard/ThreadCard.tsx`:

````tsx
import { Badge, Button, Card, Cluster, Stack, Text } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useEffect, useRef } from "react";

import type { Anchor } from "../../../shared/review/anchorSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { describeLocation } from "../../review/describeLocation";
import { Quote } from "../Quote/Quote";

import { ThreadActions } from "./ThreadActions";
import styles from "./ThreadCard.module.css";

export interface ThreadCardProps {
  hasNewAgentMessage: boolean;
  isSelected: boolean;

  /**
   * Called after the card changes the thread on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see the thread in its doc
   */
  onSelect: (thread: Thread) => void;

  thread: Thread;
}

/**
 * One thread in the sidebar: what it is on, its messages, the user's draft, and the actions the user can take
 */
export function ThreadCard({
  hasNewAgentMessage,
  isSelected,
  onChanged,
  onSelect,
  thread,
}: ThreadCardProps): JSX.Element {
  const { anchor, id, messages, status } = thread;
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);
  return (
    <Card
      as="article"
      className={clsx(styles.card, { [styles.selected ?? ""]: isSelected })}
      padding="sm"
      ref={cardRef}
      aria-label={`Thread #${id}`}
    >
      <Stack gap={2}>
        <Cluster gap={2} justify="between">
          <Button onClick={() => onSelect(thread)} size="sm" variant="ghost">
            #{id} {describeLocation(anchor)}
          </Button>
          <Cluster gap={1}>
            {hasNewAgentMessage && <Badge tone="info">New</Badge>}
            {anchor.kind === "passage" && anchor.outdated && <Badge tone="warning">Outdated</Badge>}
            {status === "resolved" && <Badge tone="success">Resolved</Badge>}
          </Cluster>
        </Cluster>
        <PassageQuote anchor={anchor} />
        {messages.length > 0 && (
          <Stack as="ol" className={styles.messages} gap={2} aria-label="Messages">
            {messages.map((message) => (
              <li key={message.at + message.author}>
                <Text size="sm" weight="bold">
                  {message.author === "user" ? "You" : "Agent"}
                </Text>{" "}
                <Text as="p" className={styles.body} size="sm">
                  {message.body}
                </Text>
              </li>
            ))}
          </Stack>
        )}
        <ThreadActions onChanged={onChanged} thread={thread} />
      </Stack>
    </Card>
  );
}

function PassageQuote({ anchor }: { anchor: Anchor }): JSX.Element | null {
  if (anchor.kind !== "passage") {
    return null;
  }
  return (
    <>
      <Quote text={anchor.anchoredText} />
      {anchor.quote !== anchor.anchoredText && (
        <Text as="p" size="sm" tone="muted">
          Originally: {anchor.quote}
        </Text>
      )}
    </>
  );
}
````

`src/web/components/ThreadCard/ThreadCard.module.css`:

````css
.card {
  border-inline-start: 3px solid transparent;
}

.selected {
  border-inline-start-color: var(--sui-color-primary);
}

.messages {
  list-style: none;
  padding: 0;
}

.body {
  white-space: pre-wrap;
}
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project web src/web/components/ThreadCard`
Expected: PASS, 11 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 446 tests; fallow `warn`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Show a thread in a card where the user can reply, edit or discard a draft, and resolve"
```

---

### Task 7: The thread sidebar

**Files:**
- Create: `src/web/review/NewComment.ts`, `src/web/review/groupThreads.ts`, `src/web/review/useSeenMessages.ts`, `src/web/components/ThreadSidebar/ThreadList.tsx`, `src/web/components/ThreadSidebar/ThreadGroup.tsx`, `src/web/components/ThreadSidebar/ThreadGroup.module.css`, `src/web/components/ThreadSidebar/NewCommentForm.tsx`, `src/web/components/ThreadSidebar/ThreadSidebar.tsx`
- Test: `src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`

**Interfaces:**
- Consumes:
  - `ThreadCard`, `CommentForm`, `Quote`, `useReviewApi` and `createFakeReviewApi` (Task 6); `NewThread` (plan 1).
- Produces:
  - `type NewComment = Omit<NewThread, "body">`: a comment the user has started in the doc.
  - `groupThreads(threads): ThreadGroups` (`{ drafts; open; outdated; resolved }`). Each group holds the review's threads first, then each doc's in path order, with whole-doc threads before passages and passages in the order they appear.
  - `useSeenMessages(): SeenMessages` (`hasNewAgentMessage(thread)`, `markSeen(thread)`), stored in `localStorage` under `markdown-review.seenMessageCounts`.
  - `<ThreadSidebar documentPath newComment onChanged onCloseNewComment onSelectThread selectedThreadId threads>`, an `aside` named "Comments".
    - A "New comment" form appears when `newComment` is set; its text box takes focus and it saves a draft.
    - The "Comment on the whole review" box adds a review-level draft.
    - A "Show comments on" segmented control chooses "This doc" or "All docs"; it shows only when a doc is open.
    - The threads are grouped in sections named "Drafts", "Open", "Outdated" and "Resolved", whose `h2` headings carry counts. Resolved starts folded.
    - In All docs, each doc's threads sit under an `h3` with the doc's path, or "Whole review".
    - Selecting a thread marks its messages seen.

- [ ] **Step 1: Write the failing tests**

`src/web/components/ThreadSidebar/ThreadSidebar.test.tsx`:

````tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import type { NewComment } from "../../review/NewComment";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { ThreadSidebar } from "./ThreadSidebar";

const agentReply = { at: "2026-10-08T09:05:00.000Z", author: "agent" as const, body: "Changed to 1h" };

const threads: Thread[] = [
  buildThread({
    anchor: buildPassageAnchor(),
    draft: { at: testTime, body: "Why 24h?" },
    id: 1,
    messages: [],
    status: "draft",
  }),
  buildThread({ anchor: buildPassageAnchor({ startOffset: 40 }), id: 2 }),
  buildThread({ anchor: buildPassageAnchor({ outdated: true }), id: 3 }),
  buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, id: 4, status: "resolved" }),
  buildThread({ anchor: { kind: "review" }, id: 5 }),
  buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), id: 6 }),
];

describe("ThreadSidebar", () => {
  test("must group this doc's threads and the review's into drafts, open, outdated and resolved", () => {
    const { render } = setUpTest();

    render();

    expect(elements.groupTitles()).toEqual(["Drafts (1)", "Open (2)", "Outdated (1)", "Resolved (1)"]);
    expect(elements.threadsIn("Drafts")).toEqual(["Thread #1"]);
    expect(elements.threadsIn("Open")).toEqual(["Thread #5", "Thread #2"]);
    expect(elements.threadsIn("Outdated")).toEqual(["Thread #3"]);
    expect(elements.threadsIn("Resolved")).toEqual(["Thread #4"]);
  });

  test("must keep resolved threads folded away when the sidebar opens", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("article", { name: "Thread #4" })).not.toBeVisible();
  });

  test("must show every doc's threads under their doc when the user chooses All docs", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("radio", { name: "All docs" }));

    const open = within(screen.getByRole("region", { name: "Open" }));
    expect(open.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
      "Whole review",
      "docs/plan.md",
      "docs/spec.md",
    ]);
    expect(elements.threadsIn("Open")).toEqual(["Thread #5", "Thread #2", "Thread #6"]);
  });

  test("must save the user's comment on the whole review as a draft when the user adds one", async () => {
    const { fake, onChanged, render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    render();

    await user.type(
      screen.getByRole("textbox", { name: "Comment on the whole review" }),
      "The spec and plan disagree."
    );
    await user.click(screen.getByRole("button", { name: "Add comment" }));

    expect(fake.snapshot.threads).toMatchObject([
      { anchor: { kind: "review" }, draft: { body: "The spec and plan disagree." } },
    ]);
    expect(onChanged).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Comment on the whole review" })).toHaveValue("");
  });

  test("must ask for the comment with the text box ready when the user starts one in the doc", async () => {
    const newComment: NewComment = {
      anchor: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: "",
      },
      renderedHash: "hash of docs/plan.md",
    };
    const { fake, onCloseNewComment, render } = setUpTest({ newComment, threads: [] });
    const user = userEvent.setup();
    render();

    await user.keyboard("Too long?");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(fake.snapshot.threads).toMatchObject([
      { anchor: { quote: "cache results for 24h", startLine: 3 }, draft: { body: "Too long?" }, status: "draft" },
    ]);
    expect(onCloseNewComment).toHaveBeenCalled();
  });

  test("must stop marking the agent's reply as new when the user selects its thread", async () => {
    const replied = buildThread({
      anchor: buildPassageAnchor(),
      id: 2,
      messages: [...buildThread().messages, agentReply],
    });
    const { onSelectThread, render } = setUpTest({ threads: [replied] });
    const user = userEvent.setup();
    render();
    const card = within(screen.getByRole("article", { name: "Thread #2" }));
    const wasNew = card.queryByText("New") !== null;

    await user.click(card.getByRole("button", { name: "#2 Line 3" }));

    expect(wasNew).toBe(true);
    expect(card.queryByText("New")).not.toBeInTheDocument();
    expect(onSelectThread).toHaveBeenCalledWith(replied);
  });

  test("must say how to comment when there are no threads", () => {
    const { render } = setUpTest({ threads: [] });

    render();

    expect(
      screen.getByText("No comments yet. Select text in the doc, or press + beside a block, to comment on it.")
    ).toBeInTheDocument();
  });
});

function setUpTest({
  newComment = null,
  threads: shown = threads,
}: { newComment?: NewComment | null; threads?: Thread[] } = {}) {
  localStorage.clear();
  const fake = createFakeReviewApi({ threads: shown });
  const onChanged = vi.fn();
  const onCloseNewComment = vi.fn();
  const onSelectThread = vi.fn();
  const render = (): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <ThreadSidebar
          documentPath="docs/plan.md"
          newComment={newComment}
          onChanged={onChanged}
          onCloseNewComment={onCloseNewComment}
          onSelectThread={onSelectThread}
          selectedThreadId={null}
          threads={shown}
        />
      </ReviewApiContext>
    );
  };
  return { fake, onChanged, onCloseNewComment, onSelectThread, render };
}

const elements = {
  groupTitles: (): string[] => screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
  threadsIn: (group: string): string[] =>
    within(screen.getByRole("region", { name: group }))
      .getAllByRole("article")
      .map((article) => article.getAttribute("aria-label") ?? ""),
};
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project web src/web/components/ThreadSidebar`
Expected: FAIL with `Failed to resolve import "./ThreadSidebar"`.

- [ ] **Step 3: Write the sidebar**

`src/web/review/NewComment.ts`:

````ts
import type { NewThread } from "../../shared/review/newThreadSchema";

/**
 * A comment the user has started in the doc and not yet written
 */
export type NewComment = Omit<NewThread, "body">;
````

`src/web/review/groupThreads.ts`:

````ts
import type { Anchor } from "../../shared/review/anchorSchema";
import type { Thread } from "../../shared/review/threadSchema";

export interface ThreadGroups {
  drafts: Thread[];
  open: Thread[];
  outdated: Thread[];
  resolved: Thread[];
}

const anchorOrder: Record<Anchor["kind"], number> = { document: 1, passage: 2, review: 0 };

/**
 * Sorts threads into the sidebar's groups
 *
 * @param threads the threads to show
 * @returns new comments in drafts, resolved threads in resolved, and the rest in outdated when their passage was lost,
 *   otherwise in open; each group holds the review's threads first, then each doc's in path order, its whole-doc
 *   threads before its passages and passages in the order they appear
 */
export function groupThreads(threads: readonly Thread[]): ThreadGroups {
  const groups: ThreadGroups = { drafts: [], open: [], outdated: [], resolved: [] };
  for (const thread of [...threads].sort(compareThreads)) {
    groups[groupOf(thread)].push(thread);
  }
  return groups;
}

function groupOf({ anchor, status }: Thread): keyof ThreadGroups {
  if (status === "draft") {
    return "drafts";
  }
  if (status === "resolved") {
    return "resolved";
  }
  return anchor.kind === "passage" && anchor.outdated ? "outdated" : "open";
}

function compareThreads(left: Thread, right: Thread): number {
  return (
    documentOf(left.anchor).localeCompare(documentOf(right.anchor)) ||
    anchorOrder[left.anchor.kind] - anchorOrder[right.anchor.kind] ||
    startOf(left.anchor) - startOf(right.anchor) ||
    left.id - right.id
  );
}

function documentOf(anchor: Anchor): string {
  return anchor.kind === "review" ? "" : anchor.document;
}

function startOf(anchor: Anchor): number {
  return anchor.kind === "passage" ? anchor.startOffset : 0;
}
````

`src/web/review/useSeenMessages.ts`:

````ts
import { useState } from "react";
import { z } from "zod";

import type { Thread } from "../../shared/review/threadSchema";

const storageKey = "markdown-review.seenMessageCounts";

const seenCountsSchema = z.record(z.string(), z.int().nonnegative());

export interface SeenMessages {
  /**
   * Whether the agent has written to the thread since the user last viewed it
   */
  hasNewAgentMessage(thread: Thread): boolean;

  /**
   * Records that the user has viewed every message on the thread
   */
  markSeen(thread: Thread): void;
}

/**
 * Remembers, across reloads of the page, how many of each thread's messages the user has viewed
 *
 * @returns what is new and a way to mark a thread viewed; a stored record the app cannot read starts afresh
 */
export function useSeenMessages(): SeenMessages {
  const [seenCounts, setSeenCounts] = useState(readSeenCounts);
  return {
    hasNewAgentMessage: (thread) =>
      thread.messages.findLastIndex((message) => message.author === "agent") >= (seenCounts[thread.id] ?? 0),
    markSeen: (thread) => {
      if (seenCounts[thread.id] === thread.messages.length) {
        return;
      }
      const next = { ...seenCounts, [thread.id]: thread.messages.length };
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSeenCounts(next);
    },
  };
}

function readSeenCounts(): Record<string, number> {
  try {
    return seenCountsSchema.parse(JSON.parse(localStorage.getItem(storageKey) ?? "{}"));
  } catch {
    return {};
  }
}
````

The Resolved group is a `<details>` inside its section, with the heading in the `<summary>`, which HTML allows:

`src/web/components/ThreadSidebar/ThreadList.tsx`:

````tsx
import { Heading, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { ThreadCard } from "../ThreadCard/ThreadCard";

export interface ThreadListProps {
  hasNewAgentMessage: (thread: Thread) => boolean;
  onChanged: () => void;
  onSelect: (thread: Thread) => void;
  selectedThreadId: number | null;

  /**
   * Whether to head each doc's threads with the doc's path, for a list that holds several docs
   */
  showsDocuments: boolean;

  /**
   * Sorted so each doc's threads are together
   */
  threads: Thread[];
}

/**
 * Thread cards, under a heading for each doc when they come from several
 */
export function ThreadList({ showsDocuments, threads, ...cardProps }: ThreadListProps): JSX.Element {
  return (
    <Stack gap={2}>
      {threads.map((thread, index) => {
        const source = sourceOf(thread);
        const previous = threads[index - 1];
        return (
          <Stack gap={2} key={thread.id}>
            {showsDocuments && (previous === undefined || sourceOf(previous) !== source) && (
              <Heading level={3} size="xs" tone="muted">
                {source}
              </Heading>
            )}
            <ThreadCard
              hasNewAgentMessage={cardProps.hasNewAgentMessage(thread)}
              isSelected={thread.id === cardProps.selectedThreadId}
              onChanged={cardProps.onChanged}
              onSelect={cardProps.onSelect}
              thread={thread}
            />
          </Stack>
        );
      })}
    </Stack>
  );
}

function sourceOf({ anchor }: Thread): string {
  return anchor.kind === "review" ? "Whole review" : anchor.document;
}
````

`src/web/components/ThreadSidebar/ThreadGroup.tsx`:

````tsx
import { Heading, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import styles from "./ThreadGroup.module.css";
import type { ThreadListProps } from "./ThreadList";
import { ThreadList } from "./ThreadList";

export interface ThreadGroupProps extends ThreadListProps {
  /**
   * Whether the group starts folded away, with only its title showing
   */
  isFolded: boolean;

  title: string;
}

/**
 * A titled group of thread cards, shown only when it has threads
 */
export function ThreadGroup({ isFolded, title, ...listProps }: ThreadGroupProps): JSX.Element | null {
  if (listProps.threads.length === 0) {
    return null;
  }
  const heading = (
    <Heading className={styles.heading} level={2} size="sm">
      {title} ({listProps.threads.length})
    </Heading>
  );
  return (
    <Stack as="section" gap={2} aria-label={title}>
      {isFolded ? (
        <details>
          <summary className={styles.summary}>{heading}</summary>
          <ThreadList {...listProps} />
        </details>
      ) : (
        <>
          {heading}
          <ThreadList {...listProps} />
        </>
      )}
    </Stack>
  );
}
````

`src/web/components/ThreadSidebar/ThreadGroup.module.css`:

````css
.summary {
  cursor: pointer;
  margin-block-end: var(--sui-space-2);
}

.summary > .heading {
  display: inline;
}
````

`src/web/components/ThreadSidebar/NewCommentForm.tsx`:

````tsx
import { Card, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";

import { useReviewApi } from "../../api/useReviewApi";
import type { NewComment } from "../../review/NewComment";
import { CommentForm } from "../CommentForm/CommentForm";
import { Quote } from "../Quote/Quote";

export interface NewCommentFormProps {
  newComment: NewComment;
  onChanged: () => void;

  /**
   * Called when the user saves or cancels the comment
   */
  onClose: () => void;
}

/**
 * Asks the user to write the comment they started in the doc, and saves it as a draft
 */
export function NewCommentForm({ newComment, onChanged, onClose }: NewCommentFormProps): JSX.Element {
  const api = useReviewApi();
  const { anchor } = newComment;
  const save = async (body: string): Promise<void> => {
    await api.createThread({ ...newComment, body });
    onChanged();
    onClose();
  };
  return (
    <Card as="section" padding="sm" aria-label="New comment">
      <Stack gap={2}>
        {anchor.kind === "passage" && <Quote text={anchor.quote} />}
        <CommentForm
          clearOnSubmit={false}
          initialBody=""
          label={anchor.kind === "document" ? "Comment on the whole doc" : "Comment"}
          onCancel={onClose}
          onSubmit={save}
          shouldFocus={true}
          submitLabel="Save draft"
        />
      </Stack>
    </Card>
  );
}
````

`src/web/components/ThreadSidebar/ThreadSidebar.tsx`:

````tsx
import { Segment, SegmentedControl, Stack, Text } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { useReviewApi } from "../../api/useReviewApi";
import { groupThreads } from "../../review/groupThreads";
import type { NewComment } from "../../review/NewComment";
import { useSeenMessages } from "../../review/useSeenMessages";
import { CommentForm } from "../CommentForm/CommentForm";

import { NewCommentForm } from "./NewCommentForm";
import { ThreadGroup } from "./ThreadGroup";

export interface ThreadSidebarProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * A comment the user started in the doc, which the sidebar asks them to write
   */
  newComment: NewComment | null;

  /**
   * Called after the sidebar changes threads on the server
   */
  onChanged: () => void;

  /**
   * Called when the user saves or cancels the new comment
   */
  onCloseNewComment: () => void;

  /**
   * Called when the user asks to see a thread in its doc
   */
  onSelectThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Every thread in the repo
   */
  threads: Thread[];
}

/**
 * The comments beside the doc: a box for commenting on the whole review, and the threads grouped as drafts, open,
 * outdated and resolved, for this doc or for every doc
 */
export function ThreadSidebar({
  documentPath,
  newComment,
  onChanged,
  onCloseNewComment,
  onSelectThread,
  selectedThreadId,
  threads,
}: ThreadSidebarProps): JSX.Element {
  const api = useReviewApi();
  const seen = useSeenMessages();
  const [scope, setScope] = useState("document");
  const showsEveryDocument = documentPath === null || scope === "all";
  const visible = showsEveryDocument
    ? threads
    : threads.filter((thread) => thread.anchor.kind === "review" || thread.anchor.document === documentPath);
  const groups = groupThreads(visible);
  const listProps = {
    hasNewAgentMessage: seen.hasNewAgentMessage,
    onChanged,
    onSelect: (thread: Thread) => {
      seen.markSeen(thread);
      onSelectThread(thread);
    },
    selectedThreadId,
    showsDocuments: showsEveryDocument,
  };
  const commentOnReview = async (body: string): Promise<void> => {
    await api.createThread({ anchor: { kind: "review" }, body });
    onChanged();
  };
  return (
    <Stack as="aside" gap={4} aria-label="Comments">
      {newComment !== null && (
        <NewCommentForm
          key={JSON.stringify(newComment.anchor)}
          newComment={newComment}
          onChanged={onChanged}
          onClose={onCloseNewComment}
        />
      )}
      <CommentForm
        clearOnSubmit={true}
        initialBody=""
        label="Comment on the whole review"
        onSubmit={commentOnReview}
        shouldFocus={false}
        submitLabel="Add comment"
      />
      {documentPath !== null && (
        <SegmentedControl label="Show comments on" onValueChange={setScope} size="sm" value={scope}>
          <Segment value="document">This doc</Segment>
          <Segment value="all">All docs</Segment>
        </SegmentedControl>
      )}
      {visible.length === 0 && (
        <Text as="p" size="sm" tone="muted">
          No comments yet. Select text in the doc, or press + beside a block, to comment on it.
        </Text>
      )}
      <ThreadGroup isFolded={false} threads={groups.drafts} title="Drafts" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.open} title="Open" {...listProps} />
      <ThreadGroup isFolded={false} threads={groups.outdated} title="Outdated" {...listProps} />
      <ThreadGroup isFolded={true} threads={groups.resolved} title="Resolved" {...listProps} />
    </Stack>
  );
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project web src/web/components/ThreadSidebar`
Expected: PASS, 7 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 453 tests; fallow `warn`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Show every thread beside the doc, grouped as drafts, open, outdated and resolved"
```

---

### Task 8: The top bar

**Files:**
- Create: `src/web/navigation/documentPagePath.ts`, `src/web/navigation/isPlainLeftClick.ts`, `src/web/components/AgentStatus/AgentStatus.tsx`, `src/web/components/SubmitMenu/SubmitMenu.tsx`, `src/web/components/DocumentLinks/DocumentLinks.tsx`, `src/web/components/DocumentsMenu/DocumentsMenu.tsx`, `src/web/components/TopBar/TopBar.tsx`, `src/web/components/TopBar/TopBar.module.css`, `src/web/testing/standInForPopovers.ts`
- Modify: `src/web/testing/setup.ts`
- Test: `src/web/components/TopBar/TopBar.test.tsx`

**Interfaces:**
- Consumes:
  - StylesUI's `Popover`/`usePopover`, `NavList`, `StatusDot`, `Badge`; `useReviewApi`, `describeFailure`, `createFakeReviewApi` (Task 6); `DocumentList` and `Verdict` (Task 3, plan 2); `ReviewState` (plan 1).
- Produces:
  - `documentPagePath(document): string`, e.g. `/document/docs/Design%20Notes.md`, and `isPlainLeftClick(event): boolean`.
  - `<AgentStatus agentWaiting>`, a `status` region reading "Agent waiting" or "Agent not listening, comments will wait in the inbox".
  - `<SubmitMenu draftCount onSubmitted>`: a "Submit (N)" button that opens a dialog named "Submit review".
    - "Request changes" is disabled when N is 0; "Approve" is always available.
    - A refusal shows as an alert.
    - On success the dialog closes and `onSubmitted` is called.
  - `<DocumentLinks list onNavigate>`, a `nav` named "Docs" with two groups. "With comments" links read like "docs/plan.md 1 open, 0 drafts", and "Recently opened" lists the other recent docs. With neither it says how the agent opens a doc.
  - `<DocumentsMenu onNavigate>`: a "Docs" button that reads the list each time it opens.
  - `<TopBar agentWaiting documentPath draftCount onNavigate onSubmitted review>`: a `header` holding:
    - "Markdown Review", which links to `/`;
    - an `h1` with the doc's path, or "Docs" on the docs list;
    - the docs menu, the agent's status, an "Approved" badge while `review.approved`, and Submit.
  - `src/web/testing/standInForPopovers.ts`. It opens and closes popovers as browsers do, including a `popovertarget` button's click, and sends `beforetoggle` and `toggle`; it follows StylesUI's own test setup.

- [ ] **Step 1: Write the failing tests and the popover stand-in**

jsdom has no Popover API, so without a stand-in a `popovertarget` button does nothing and every popover stays hidden:

`src/web/testing/standInForPopovers.ts`:

````ts
// jsdom has no Popover API: a button's popovertarget does nothing, and its stylesheet hides every popover because none
// ever matches :popover-open. These stand-ins open and close popovers as browsers do, sending the beforetoggle and
// toggle events StylesUI's popovers listen for, and mark an open popover with an attribute that undoes the hiding.

const openAttribute = "data-popover-open";

const popoverStyle = document.createElement("style");
popoverStyle.textContent = `[popover][${openAttribute}] { display: block !important; }`;
document.head.append(popoverStyle);

const openingStates = { newState: "open", oldState: "closed" };

const closingStates = { newState: "closed", oldState: "open" };

function changePopover(popover: HTMLElement, open: boolean): void {
  const states = open ? openingStates : closingStates;
  const beforeToggle = Object.assign(new Event("beforetoggle", { cancelable: true }), states);
  if (popover.hasAttribute(openAttribute) !== open && popover.dispatchEvent(beforeToggle)) {
    popover.toggleAttribute(openAttribute, open);
    popover.dispatchEvent(Object.assign(new Event("toggle"), states));
  }
}

HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement): void {
  changePopover(this, true);
};

HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement): void {
  changePopover(this, false);
};

HTMLElement.prototype.togglePopover = function togglePopover(this: HTMLElement): boolean {
  changePopover(this, !this.hasAttribute(openAttribute));
  return this.hasAttribute(openAttribute);
};

const matches = Element.prototype.matches;

Element.prototype.matches = function matchesWithPopoverOpen(this: Element, selectors: string): boolean {
  return matches.call(this, selectors.replaceAll(":popover-open", `[${openAttribute}]`));
} as typeof matches;

document.addEventListener("click", (event) => {
  const trigger = event.target instanceof Element ? event.target.closest("button[popovertarget]") : null;
  const popover = document.getElementById(trigger?.getAttribute("popovertarget") ?? "");
  popover?.togglePopover();
});
````

`src/web/testing/setup.ts`:

````ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "./standInForLayout";
import "./standInForPopovers";

// Testing Library only cleans up automatically when Vitest globals are on
afterEach(() => {
  cleanup();
});
````

`src/web/components/TopBar/TopBar.test.tsx`:

````tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { ReviewApiError } from "../../api/ReviewApiError";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { TopBar } from "./TopBar";

const draftThread = buildThread({
  anchor: buildPassageAnchor(),
  draft: { at: testTime, body: "Why 24h?" },
  messages: [],
  status: "draft",
});

describe("TopBar", () => {
  test("must show the doc's path and that the agent is waiting when the agent has a poll open", () => {
    const { render } = setUpTest();

    render({ agentWaiting: true });

    expect(screen.getByRole("heading", { level: 1, name: "docs/plan.md" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Agent waiting");
  });

  test("must say comments will wait in the inbox when the agent is not listening", () => {
    const { render } = setUpTest();

    render();

    expect(screen.getByRole("status")).toHaveTextContent("Agent not listening, comments will wait in the inbox");
  });

  test("must show the review as approved when the user approved this round", () => {
    const { render } = setUpTest();

    render({ review: { approved: true, approvedAt: testTime, requestedAt: testTime } });

    expect(screen.getByText("Approved")).toBeInTheDocument();
  });

  test("must offer only approval when the user has no drafts", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 0 });

    await user.click(screen.getByRole("button", { name: "Submit (0)" }));

    expect(elements.submitDialog().getByRole("button", { name: "Request changes" })).toBeDisabled();
    expect(elements.submitDialog().getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  test("must send the drafts to the agent when the user requests changes", async () => {
    const { fake, onSubmitted, render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Request changes" }));

    expect(fake.snapshot.threads).toMatchObject([{ messages: [{ author: "user", body: "Why 24h?" }], status: "open" }]);
    expect(fake.snapshot.review.approved).toBe(false);
    expect(onSubmitted).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Submit review" })).not.toBeInTheDocument();
  });

  test("must approve the review when the user approves", async () => {
    const { fake, render } = setUpTest();
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Approve" }));

    expect(fake.snapshot.review.approved).toBe(true);
  });

  test("must show why when the server refuses the submit", async () => {
    const { fake, render } = setUpTest();
    fake.api.submit.mockRejectedValueOnce(new ReviewApiError(409, "invalid-state", "There are no drafts to submit"));
    const user = userEvent.setup();
    render({ draftCount: 1 });

    await user.click(screen.getByRole("button", { name: "Submit (1)" }));
    await user.click(elements.submitDialog().getByRole("button", { name: "Request changes" }));

    expect(await elements.submitDialog().findByRole("alert")).toHaveTextContent("There are no drafts to submit");
  });

  test("must list docs with comments, then other recent docs, when the user opens the docs menu", async () => {
    const { render } = setUpTest({ recent: ["docs/spec.md", "docs/plan.md"] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Docs" }));

    const docs = within(screen.getByRole("navigation", { name: "Docs" }));
    expect(await docs.findByRole("link", { name: "docs/plan.md 0 open, 1 draft" })).toHaveAttribute(
      "href",
      "/document/docs/plan.md"
    );
    expect(docs.getByRole("link", { name: "docs/spec.md" })).toHaveAttribute("href", "/document/docs/spec.md");
  });

  test("must show the chosen doc in the page when the user picks it from the docs menu", async () => {
    const { onNavigate, render } = setUpTest({ recent: ["docs/spec.md"] });
    const user = userEvent.setup();
    render();

    await user.click(screen.getByRole("button", { name: "Docs" }));
    await user.click(await screen.findByRole("link", { name: "docs/spec.md" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md");
  });
});

interface RenderOptions {
  agentWaiting?: boolean;
  draftCount?: number;
  review?: ReviewState;
}

function setUpTest({ recent = [] }: { recent?: string[] } = {}) {
  const fake = createFakeReviewApi({ recent, threads: [draftThread] });
  const onNavigate = vi.fn();
  const onSubmitted = vi.fn();
  const render = ({
    agentWaiting = false,
    draftCount = 0,
    review = fake.snapshot.review,
  }: RenderOptions = {}): void => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <TopBar
          agentWaiting={agentWaiting}
          documentPath="docs/plan.md"
          draftCount={draftCount}
          onNavigate={onNavigate}
          onSubmitted={onSubmitted}
          review={review}
        />
      </ReviewApiContext>
    );
  };
  return { fake, onNavigate, onSubmitted, render };
}

const elements = {
  submitDialog: () => within(screen.getByRole("dialog", { name: "Submit review" })),
};
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project web src/web/components/TopBar`
Expected: FAIL with `Failed to resolve import "./TopBar"`.

- [ ] **Step 3: Write the top bar**

`src/web/navigation/documentPagePath.ts`:

````ts
/**
 * @param document a repo-relative POSIX path
 * @returns the path of the app's page for the doc, e.g. "/document/docs/Design%20Notes.md"
 */
export function documentPagePath(document: string): string {
  return `/document/${document.split("/").map(encodeURIComponent).join("/")}`;
}
````

`src/web/navigation/isPlainLeftClick.ts`:

````ts
/**
 * Tells whether a click on a link should follow it in the page, rather than in a new tab or window as a middle click
 * or a click with a modifier key asks the browser to
 */
export function isPlainLeftClick(
  event: Pick<MouseEvent, "altKey" | "button" | "ctrlKey" | "metaKey" | "shiftKey">
): boolean {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}
````

`src/web/components/AgentStatus/AgentStatus.tsx`:

````tsx
import { Cluster, StatusDot, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

export interface AgentStatusProps {
  /**
   * Whether the agent has a poll open, waiting for the user to submit
   */
  agentWaiting: boolean;
}

/**
 * Says whether the agent will see a submit at once or later from its inbox
 */
export function AgentStatus({ agentWaiting }: AgentStatusProps): JSX.Element {
  return (
    <Cluster gap={1} role="status">
      <StatusDot tone={agentWaiting ? "success" : "neutral"} variant={agentWaiting ? "solid" : "ring"} />
      <Text size="sm">{agentWaiting ? "Agent waiting" : "Agent not listening, comments will wait in the inbox"}</Text>
    </Cluster>
  );
}
````

`src/web/components/SubmitMenu/SubmitMenu.tsx`:

````tsx
import { Alert, Button, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { Verdict } from "../../../shared/api/apiRequestSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";

export interface SubmitMenuProps {
  /**
   * The drafts in the whole repo: new comments and replies
   */
  draftCount: number;

  /**
   * Called after the drafts are submitted
   */
  onSubmitted: () => void;
}

/**
 * Sends every draft to the agent, either asking for changes or approving the review
 */
export function SubmitMenu({ draftCount, onSubmitted }: SubmitMenuProps): JSX.Element {
  const api = useReviewApi();
  const popover = usePopover({ placement: "bottom" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<Verdict | null>(null);
  const submit = async (verdict: Verdict): Promise<void> => {
    setSubmitting(verdict);
    try {
      await api.submit(verdict);
      setError(null);
      popover.close();
      onSubmitted();
    } catch (failure) {
      setError(describeFailure(failure));
    } finally {
      setSubmitting(null);
    }
  };
  return (
    <>
      <Button {...popover.getTriggerProps()}>Submit ({draftCount})</Button>
      <Popover {...popover.getOverlayProps()} aria-label="Submit review" role="dialog">
        <Stack gap={2}>
          <Text as="p" size="sm">
            {draftCount === 0
              ? "You have no drafts. Approve to tell the agent to carry on."
              : `Sends ${draftCount === 1 ? "1 draft" : `${draftCount} drafts`} to the agent.`}
          </Text>
          <Button
            busy={submitting === "request-changes"}
            disabled={draftCount === 0}
            onClick={() => void submit("request-changes")}
            variant="secondary"
          >
            Request changes
          </Button>
          <Button busy={submitting === "approve"} onClick={() => void submit("approve")}>
            Approve
          </Button>
          {error !== null && (
            <Alert role="alert" tone="danger">
              {error}
            </Alert>
          )}
        </Stack>
      </Popover>
    </>
  );
}
````

`src/web/components/DocumentLinks/DocumentLinks.tsx`:

````tsx
import { NavList, NavListGroup, NavListItem, Text } from "@krelborn/stylesui";
import type { JSX, MouseEvent } from "react";

import type { DocumentList } from "../../../shared/api/apiResponseSchemas";
import { documentPagePath } from "../../navigation/documentPagePath";
import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";

export interface DocumentLinksProps {
  list: DocumentList;

  /**
   * Shows the app's page for a doc
   */
  onNavigate: (pagePath: string) => void;
}

/**
 * Links to the docs with comments, with their counts, and to the other docs opened recently
 */
export function DocumentLinks({ list, onNavigate }: DocumentLinksProps): JSX.Element {
  const recent = list.recent.filter((document) => !list.documents.some((count) => count.document === document));
  const follow = (event: MouseEvent<HTMLAnchorElement>, document: string): void => {
    if (isPlainLeftClick(event)) {
      event.preventDefault();
      onNavigate(documentPagePath(document));
    }
  };
  if (list.documents.length === 0 && recent.length === 0) {
    return (
      <Text as="p" size="sm">
        No docs yet. The agent opens a doc for review with <code>markdown-review open &lt;doc.md&gt;</code>.
      </Text>
    );
  }
  return (
    <NavList aria-label="Docs">
      {list.documents.length > 0 && (
        <NavListGroup headingLevel={2} title="With comments">
          {list.documents.map(({ document, draftCount, openCount }) => (
            <NavListItem
              href={documentPagePath(document)}
              key={document}
              onClick={(event) => follow(event, document)}
              trailing={`${openCount} open, ${draftCount} ${draftCount === 1 ? "draft" : "drafts"}`}
            >
              {document}
            </NavListItem>
          ))}
        </NavListGroup>
      )}
      {recent.length > 0 && (
        <NavListGroup headingLevel={2} title="Recently opened">
          {recent.map((document) => (
            <NavListItem href={documentPagePath(document)} key={document} onClick={(event) => follow(event, document)}>
              {document}
            </NavListItem>
          ))}
        </NavListGroup>
      )}
    </NavList>
  );
}
````

`src/web/components/DocumentsMenu/DocumentsMenu.tsx`:

````tsx
import { Alert, Button, Popover, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { DocumentList } from "../../../shared/api/apiResponseSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { DocumentLinks } from "../DocumentLinks/DocumentLinks";

export interface DocumentsMenuProps {
  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;
}

/**
 * Lists the docs with comments and the docs opened recently, so the user can move between them
 */
export function DocumentsMenu({ onNavigate }: DocumentsMenuProps): JSX.Element {
  const api = useReviewApi();
  const [list, setList] = useState<DocumentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popover = usePopover({
    onOpenChange: (open) => {
      if (open) {
        api.readDocuments().then(setList, (failure: unknown) => setError(describeFailure(failure)));
      }
    },
  });
  return (
    <>
      <Button {...popover.getTriggerProps()} variant="ghost">
        Docs
      </Button>
      <Popover {...popover.getOverlayProps()}>
        {error !== null && <Alert tone="danger">{error}</Alert>}
        {list !== null && (
          <DocumentLinks
            list={list}
            onNavigate={(pagePath) => {
              popover.close();
              onNavigate(pagePath);
            }}
          />
        )}
      </Popover>
    </>
  );
}
````

`src/web/components/TopBar/TopBar.tsx`:

````tsx
import { Badge, Cluster, Heading, Link } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";
import { AgentStatus } from "../AgentStatus/AgentStatus";
import { DocumentsMenu } from "../DocumentsMenu/DocumentsMenu";
import { SubmitMenu } from "../SubmitMenu/SubmitMenu";

import styles from "./TopBar.module.css";

export interface TopBarProps {
  agentWaiting: boolean;

  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  draftCount: number;

  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;

  /**
   * Called after the user submits their drafts
   */
  onSubmitted: () => void;

  review: ReviewState;
}

/**
 * The bar across the top of the page: where the user is, whether the agent is listening, and the submit button
 */
export function TopBar({
  agentWaiting,
  documentPath,
  draftCount,
  onNavigate,
  onSubmitted,
  review,
}: TopBarProps): JSX.Element {
  return (
    <Cluster as="header" className={styles.topBar} gap={4} justify="between">
      <Cluster gap={3}>
        <Link
          href="/"
          onClick={(event) => {
            if (isPlainLeftClick(event)) {
              event.preventDefault();
              onNavigate("/");
            }
          }}
          tone="inherit"
          underline="hover"
        >
          Markdown Review
        </Link>
        <Heading className={styles.path} level={1} size="md">
          {documentPath ?? "Docs"}
        </Heading>
        <DocumentsMenu onNavigate={onNavigate} />
      </Cluster>
      <Cluster gap={3}>
        <AgentStatus agentWaiting={agentWaiting} />
        {review.approved && (
          <Badge tone="success" variant="solid">
            Approved
          </Badge>
        )}
        <SubmitMenu draftCount={draftCount} onSubmitted={onSubmitted} />
      </Cluster>
    </Cluster>
  );
}
````

`src/web/components/TopBar/TopBar.module.css`:

````css
.topBar {
  border-block-end: var(--sui-border-width) solid var(--sui-color-border);
  padding: var(--sui-space-2) var(--sui-space-4);
}

.path {
  font-family: var(--sui-font-mono);
  overflow-wrap: anywhere;
}
````

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run --project web src/web/components/TopBar`
Expected: PASS, 9 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 462 tests; fallow `warn`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the top bar: the docs menu, whether the agent is listening, and Submit"
```

---

### Task 9: The document view

**Files:**
- Create: `src/web/anchoring/blockPassage.ts`, `src/web/review/isHighlighted.ts`, `src/web/review/threadAtOffset.ts`, `src/web/components/DocumentView/useRenderedDocument.ts`, `src/web/components/DocumentView/useThreadHighlights.ts`, `src/web/components/DocumentView/useSelectionComment.ts`, `src/web/components/DocumentView/useHoveredBlock.ts`, `src/web/components/DocumentView/useDocumentClicks.ts`, `src/web/components/DocumentView/useRevealSelectedThread.ts`, `src/web/components/DocumentView/useScrollToHeading.ts`, `src/web/components/DocumentView/useDocumentNavigation.ts`, `src/web/components/DocumentView/useMermaidDiagrams.ts`, `src/web/components/DocumentView/DocumentControls.tsx`, `src/web/components/DocumentView/DocumentView.tsx`, `src/web/components/DocumentView/DocumentView.module.css`, `src/web/testing/standInForHighlights.ts`
- Modify: `src/web/testing/standInForLayout.ts`, `src/web/testing/setup.ts`
- Test: `src/web/components/DocumentView/DocumentView.test.tsx`

**Interfaces:**
- Consumes:
  - `renderDocument`, `renderMermaidDiagrams` (Task 4); `selectedPassage`, `rangeForPassage`, `offsetAtPoint`, `passageAnchor`, `blockElementAt` (Task 5); `isPlainLeftClick` (Task 8); `NewComment` (Task 7); `DocumentSource` (Task 3); `createDocumentText` (plan 1).
- Produces:
  - `<DocumentView document hash onComment onNavigate onSelectThread selectedThreadId threads>`: a "Comment on this doc" button, then the rendered doc in an `article` named by its path. Over the doc sit:
    - "Comment on this block" (+), beside the block under the pointer;
    - a "Thread #N" marker beside each highlighted passage;
    - a "Comment" button beside selected text.
  - `onComment(newComment)` receives the passage, block or doc anchor, with `renderedHash` set to the hash of the source on screen.
  - Highlights are registered as `threadsHighlightName` and `selectedHighlightName` (both exported from `useThreadHighlights.ts`).
  - Following links:
    - A click on a `#heading` link scrolls to the heading.
    - A plain click on a `/document/…` link calls `onNavigate`.
    - A click on highlighted text selects its thread.
  - The heading in `hash` is scrolled to once per doc. A new rendering keeps the user's place.
  - `blockPassage(documentText, documentPath, blockIndex): NewPassageAnchor | null`, `isHighlighted(thread, selectedThreadId): boolean` and `threadAtOffset(threads, offset): Thread | null`.
  - `src/web/testing/standInForHighlights.ts` keeps `CSS.highlights` in a `Map` of `Set`s of ranges, which tests read. `standInForLayout.ts` gains a no-op `ResizeObserver` and empty range geometry.

- [ ] **Step 1: Write the failing tests and the stand-ins they need**

The highlight stand-in lets component tests read which text is highlighted; the layout stand-in gives every range an empty box:

`src/web/testing/standInForHighlights.ts`:

````ts
// jsdom has no CSS Custom Highlight API. This stand-in keeps the registered highlights, so tests can read the ranges
// the app highlights.

class StandInHighlight extends Set<AbstractRange> {
  public constructor(...ranges: AbstractRange[]) {
    super(ranges);
  }
}

Object.assign(globalThis, { Highlight: StandInHighlight });
Object.assign(globalThis.CSS, { highlights: new Map<string, StandInHighlight>() });
````

`src/web/testing/standInForLayout.ts`:

````ts
// jsdom lays nothing out, so it has no ResizeObserver, no geometry for ranges and no scrolling; these stand-ins let
// components that measure or scroll the page run, with every box empty and at the top left

class StandInResizeObserver {
  public disconnect(): void {}

  public observe(): void {}

  public unobserve(): void {}
}

Object.assign(globalThis, { ResizeObserver: StandInResizeObserver });

Range.prototype.getBoundingClientRect = () => new DOMRect();

Range.prototype.getClientRects = () => Object.assign([], { item: () => null });

Element.prototype.scrollIntoView = () => {};
````

`src/web/testing/setup.ts`:

````ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "./standInForHighlights";
import "./standInForLayout";
import "./standInForPopovers";

// Testing Library only cleans up automatically when Vitest globals are on
afterEach(() => {
  cleanup();
});
````

`src/web/components/DocumentView/DocumentView.test.tsx`:

````tsx
import { render as renderBase, screen, waitFor, waitForElementToBeRemoved, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { buildPassageAnchor, buildThread } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";

import { DocumentView } from "./DocumentView";
import { selectedHighlightName, threadsHighlightName } from "./useThreadHighlights";

const source = [
  "# Plan",
  "",
  "We cache results for **24h** today. See the [spec](spec.md#goals).",
  "",
  "## Goals",
  "",
  "Retries happen three times.",
  "",
].join("\n");

const plan: DocumentSource = { hash: "hash of the plan", path: "docs/plan.md", source };

const cacheAnchor = buildPassageAnchor({ endOffset: 29, prefix: "Plan\nWe ", startOffset: 8 });

const retriesAnchor = buildPassageAnchor({ anchoredText: "Retries", endOffset: 64, quote: "Retries", startOffset: 57 });

afterEach(() => {
  Reflect.deleteProperty(document, "caretPositionFromPoint");
  vi.restoreAllMocks();
});

describe("DocumentView", () => {
  test("must show the rendered doc when it opens", async () => {
    const { render } = setUpTest();

    await render();

    expect(within(elements.article()).getByRole("heading", { level: 2, name: "Goals" })).toHaveAttribute("id", "goals");
  });

  test("must start a comment on the selected text when the user clicks Comment beside it", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    selectText("cache", "24h");
    await user.click(await screen.findByRole("button", { name: "Comment" }));

    expect(onComment).toHaveBeenCalledWith({
      anchor: {
        document: "docs/plan.md",
        endOffset: 29,
        kind: "passage",
        prefix: "Plan\nWe ",
        quote: "cache results for 24h",
        startOffset: 8,
        suffix: " today. See the spec.\nGoals\nRetr",
      },
      renderedHash: "hash of the plan",
    });
  });

  test("must start a comment on the whole block when the user presses + beside it", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.hover(within(elements.article()).getByText("Retries happen three times."));
    await user.click(screen.getByRole("button", { name: "Comment on this block" }));

    expect(onComment).toHaveBeenCalledWith(
      expect.objectContaining({ anchor: expect.objectContaining({ quote: "Retries happen three times." }) })
    );
  });

  test("must start a comment on the whole doc when the user asks to", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("button", { name: "Comment on this doc" }));

    expect(onComment).toHaveBeenCalledWith({ anchor: { document: "docs/plan.md", kind: "document" } });
  });

  test("must highlight open and draft passages, and the selected thread's apart, but not resolved or outdated ones", async () => {
    const { render } = setUpTest({
      selectedThreadId: 2,
      threads: [
        buildThread({ anchor: cacheAnchor, id: 1 }),
        buildThread({ anchor: retriesAnchor, id: 2 }),
        buildThread({ anchor: retriesAnchor, id: 3, status: "resolved" }),
        buildThread({ anchor: { ...cacheAnchor, outdated: true }, id: 4 }),
      ],
    });

    await render();

    expect(elements.highlighted(threadsHighlightName)).toEqual(["cache results for 24h"]);
    expect(elements.highlighted(selectedHighlightName)).toEqual(["Retries"]);
    expect(screen.getAllByRole("button", { name: /^Thread #/ }).map((marker) => marker.textContent)).toEqual([
      "1",
      "2",
    ]);
  });

  test("must select a thread when the user clicks its marker", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("button", { name: "Thread #1" }));

    expect(onSelectThread).toHaveBeenCalledWith(1);
  });

  test("must select a thread when the user clicks its highlighted text", async () => {
    const { onSelectThread, render } = setUpTest({ threads: [buildThread({ anchor: cacheAnchor, id: 1 })] });
    const user = userEvent.setup();
    await render();
    const text = within(elements.article()).getByText("We cache results for", { exact: false }).firstChild;
    Object.assign(document, { caretPositionFromPoint: () => ({ offset: 10, offsetNode: text }) });

    await user.click(within(elements.article()).getByText("We cache results for", { exact: false }));

    expect(onSelectThread).toHaveBeenCalledWith(1);
  });

  test("must show a linked doc in the page when the user follows a link to it", async () => {
    const { onNavigate, render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(within(elements.article()).getByRole("link", { name: "spec" }));

    expect(onNavigate).toHaveBeenCalledWith("/document/docs/spec.md#goals");
  });

  test("must still offer a comment on the whole doc when the doc is empty", async () => {
    const { onComment, render } = setUpTest();
    const user = userEvent.setup();
    await render({ ...plan, source: "" });

    await user.click(screen.getByRole("button", { name: "Comment on this doc" }));

    expect(elements.article()).toBeEmptyDOMElement();
    expect(onComment).toHaveBeenCalledWith({ anchor: { document: "docs/plan.md", kind: "document" } });
  });

  test("must stop offering Comment when the user selects text outside the doc", async () => {
    const { render } = setUpTest();
    await render();
    const outside = document.createElement("p");
    outside.textContent = "Sidebar text";
    document.body.append(outside);
    selectText("cache", "24h");
    const comment = await screen.findByRole("button", { name: "Comment" });

    const range = document.createRange();
    range.selectNodeContents(outside);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    await waitForElementToBeRemoved(comment);
  });

  test("must scroll to the heading the address names once, and keep the user's place when the doc changes", async () => {
    const scrolledTo: string[] = [];
    vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function recordScroll(this: Element) {
      scrolledTo.push(this.id);
    });
    const { render, rerender } = setUpTest({ hash: "#goals" });
    await render();
    await waitFor(() => expect(scrolledTo).toEqual(["goals"]));

    await rerender({ ...plan, source: `${source}\nAnother paragraph.\n` });

    expect(await within(elements.article()).findByText("Another paragraph.")).toBeInTheDocument();
    expect(scrolledTo).toEqual(["goals"]);
  });

  test("must show the new text in place when the doc's source changes", async () => {
    const { render, rerender } = setUpTest();
    await render();

    await rerender({ ...plan, source: "# Plan\n\nWe cache results for 1h today.\n" });

    expect(await within(elements.article()).findByText("We cache results for 1h today.")).toBeInTheDocument();
    expect(within(elements.article()).queryByText("Retries happen three times.")).not.toBeInTheDocument();
  });
});

interface SetUpOptions {
  hash?: string;
  selectedThreadId?: number | null;
  threads?: Thread[];
}

function setUpTest({ hash = "", selectedThreadId = null, threads = [] }: SetUpOptions = {}) {
  const onComment = vi.fn();
  const onNavigate = vi.fn();
  const onSelectThread = vi.fn();
  const view = (shown: DocumentSource) => (
    <DocumentView
      document={shown}
      hash={hash}
      onComment={onComment}
      onNavigate={onNavigate}
      onSelectThread={onSelectThread}
      selectedThreadId={selectedThreadId}
      threads={threads}
    />
  );
  let rerenderBase: (ui: ReturnType<typeof view>) => void = () => {};
  const render = async (shown = plan): Promise<void> => {
    rerenderBase = renderBase(view(shown)).rerender;
    if (shown.source !== "") {
      await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
    }
  };
  const rerender = async (shown: DocumentSource): Promise<void> => {
    rerenderBase(view(shown));
    await within(elements.article()).findByRole("heading", { level: 1, name: "Plan" });
  };
  return { onComment, onNavigate, onSelectThread, render, rerender };
}

function selectText(from: string, through: string): void {
  const article = elements.article();
  const start = within(article).getByText(from, { exact: false }).firstChild;
  const end = within(article).getByText(through).firstChild;
  const range = document.createRange();
  range.setStart(start ?? article, start?.textContent?.indexOf(from) ?? 0);
  range.setEnd(end ?? article, through.length);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

const elements = {
  article: () => screen.getByRole("article", { name: "docs/plan.md" }),
  highlighted: (name: string): string[] => [...(CSS.highlights.get(name) ?? [])].map((range) => range.toString()),
  markers: (): string[] =>
    screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? "")
      .filter((label) => label.startsWith("Thread #")),
};
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project web src/web/components/DocumentView`
Expected: FAIL with `Failed to resolve import "./DocumentView"`.

- [ ] **Step 3: Write the rules for highlights and clicks**

`src/web/anchoring/blockPassage.ts`:

````ts
import type { DocumentText } from "../../shared/markdown/DocumentText";
import type { NewPassageAnchor } from "../../shared/review/newThreadSchema";

import { passageAnchor } from "./passageAnchor";

/**
 * Builds the anchor of a comment on a whole block, whose quote is the block's whole text
 *
 * @param documentText the doc's canonical text
 * @param documentPath the doc's repo-relative path
 * @param blockIndex the block's index, as its `data-md-block` gives it
 * @returns the anchor, or null when the doc has no such block
 */
export function blockPassage(
  documentText: DocumentText,
  documentPath: string,
  blockIndex: number
): NewPassageAnchor | null {
  const start = documentText.blockStartOffsets[blockIndex];
  const block = documentText.blocks[blockIndex];
  if (start === undefined || block === undefined) {
    return null;
  }
  return passageAnchor(documentText, documentPath, start, start + block.text.length);
}
````

`src/web/review/isHighlighted.ts`:

````ts
import type { Thread } from "../../shared/review/threadSchema";

/**
 * Tells whether the doc highlights a thread's passage
 *
 * @param selectedThreadId the thread the user has selected, which is highlighted even when resolved
 * @returns true for a passage that is still found in the doc, on a draft or open thread or the selected one
 */
export function isHighlighted({ anchor, id, status }: Thread, selectedThreadId: number | null): boolean {
  return anchor.kind === "passage" && !anchor.outdated && (status !== "resolved" || id === selectedThreadId);
}
````

`src/web/review/threadAtOffset.ts`:

````ts
import type { Thread } from "../../shared/review/threadSchema";

/**
 * Finds the thread whose passage holds a character of its doc, for a click on highlighted text
 *
 * @param threads the threads whose passages are highlighted
 * @param offset the character's offset in the doc's canonical text
 * @returns the thread with the shortest passage that holds the character or ends just before it, or null
 */
export function threadAtOffset(threads: readonly Thread[], offset: number): Thread | null {
  let found: Thread | null = null;
  let foundLength = Infinity;
  for (const thread of threads) {
    const { anchor } = thread;
    if (anchor.kind === "passage" && anchor.startOffset <= offset && offset <= anchor.endOffset) {
      const length = anchor.endOffset - anchor.startOffset;
      if (length < foundLength) {
        found = thread;
        foundLength = length;
      }
    }
  }
  return found;
}
````

- [ ] **Step 4: Write the view's hooks**

Each behaviour of the view is a hook, which keeps `DocumentView` under fallow's complexity limit: fallow counts every hook a component calls.

The hooks take refs to two elements: the view, which positions the controls, and the content, which holds the rendered HTML. `useThreadHighlights` measures in a layout effect, after React has written the HTML, and again whenever the content resizes, for example when a diagram is drawn. The threads it is given must keep their identity between renders, so `DocumentView` memoizes them.

`src/web/components/DocumentView/useRenderedDocument.ts`:

````ts
import { useEffect, useState } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { createDocumentText } from "../../../shared/markdown/createDocumentText";
import type { DocumentText } from "../../../shared/markdown/DocumentText";
import { describeFailure } from "../../api/describeFailure";
import { renderDocument } from "../../rendering/renderDocument";

export interface RenderedDocument {
  documentText: DocumentText;
  html: string;
}

export interface RenderingState {
  error: string | null;

  /**
   * The doc's last rendering, kept while a newer source renders so the page does not go blank
   */
  rendered: RenderedDocument | null;
}

/**
 * Renders a doc's source again whenever it changes
 */
export function useRenderedDocument({ path, source }: DocumentSource): RenderingState {
  const [state, setState] = useState<RenderingState>({ error: null, rendered: null });
  useEffect(() => {
    let isCurrent = true;
    renderDocument(source, path).then(
      (html) => {
        if (isCurrent) {
          setState({ error: null, rendered: { documentText: createDocumentText(source), html } });
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setState((previous) => ({ ...previous, error: describeFailure(failure) }));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [path, source]);
  return state;
}
````

`src/web/components/DocumentView/useThreadHighlights.ts`:

````ts
import type { RefObject } from "react";
import { useEffect, useLayoutEffect, useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { rangeForPassage } from "../../anchoring/rangeForPassage";

import type { RenderedDocument } from "./useRenderedDocument";

export const threadsHighlightName = "markdown-review-threads";

export const selectedHighlightName = "markdown-review-selected";

export interface ThreadMarker {
  /**
   * How many markers sit before this one on the same line
   */
  column: number;

  threadId: number;

  /**
   * Where the thread's passage starts, relative to the view
   */
  top: number;
}

interface ThreadRange {
  range: Range;
  thread: Thread;
}

/**
 * Highlights the threads' passages in the rendered doc, the selected thread's apart from the rest, and measures
 * where each passage starts so the view can mark it
 *
 * @param threads the threads to highlight; a new array on every render would measure the page on every render
 * @returns a marker for each passage found in the page, top to bottom
 */
export function useThreadHighlights(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  threads: readonly Thread[],
  selectedThreadId: number | null
): ThreadMarker[] {
  const [markers, setMarkers] = useState<ThreadMarker[]>([]);
  const [layoutRevision, setLayoutRevision] = useState(0);
  useEffect(() => {
    const content = contentRef.current;
    if (content === null) {
      return;
    }
    const observer = new ResizeObserver(() => setLayoutRevision((revision) => revision + 1));
    observer.observe(content);
    return () => observer.disconnect();
  }, [contentRef]);
  useLayoutEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null || rendered === null) {
      setMarkers([]);
      return;
    }
    const ranges = threads.flatMap((thread): ThreadRange[] => {
      const { anchor } = thread;
      const range =
        anchor.kind === "passage"
          ? rangeForPassage(content, rendered.documentText, anchor.startOffset, anchor.endOffset)
          : null;
      return range === null ? [] : [{ range, thread }];
    });
    const isSelected = ({ thread }: ThreadRange): boolean => thread.id === selectedThreadId;
    CSS.highlights.set(
      threadsHighlightName,
      new Highlight(...ranges.filter((range) => !isSelected(range)).map(({ range }) => range))
    );
    CSS.highlights.set(selectedHighlightName, new Highlight(...ranges.filter(isSelected).map(({ range }) => range)));
    setMarkers(placeMarkers(ranges, view.getBoundingClientRect().top));
    return () => {
      CSS.highlights.delete(threadsHighlightName);
      CSS.highlights.delete(selectedHighlightName);
    };
  }, [contentRef, layoutRevision, rendered, selectedThreadId, threads, viewRef]);
  return markers;
}

function placeMarkers(ranges: readonly ThreadRange[], viewTop: number): ThreadMarker[] {
  const placed = ranges
    .map(({ range, thread }) => ({
      threadId: thread.id,
      top: (range.getClientRects()[0] ?? range.getBoundingClientRect()).top - viewTop,
    }))
    .sort((left, right) => left.top - right.top || left.threadId - right.threadId);
  let column = 0;
  return placed.map((marker, index) => {
    const previous = placed[index - 1];
    column = previous !== undefined && Math.abs(marker.top - previous.top) < 4 ? column + 1 : 0;
    return { ...marker, column };
  });
}
````

`src/web/components/DocumentView/useSelectionComment.ts`:

````ts
import type { RefObject } from "react";
import { useEffect, useState } from "react";

import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import { selectedPassage } from "../../anchoring/selectedPassage";

import type { RenderedDocument } from "./useRenderedDocument";

export interface SelectionComment {
  anchor: NewPassageAnchor;

  /**
   * Where the selection ends, relative to the view
   */
  left: number;

  top: number;
}

/**
 * Follows the user's selection in the rendered doc
 *
 * @returns the anchor a comment on the selected text would have and where to offer it, or null when no text of the
 *   doc is selected
 */
export function useSelectionComment(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  documentPath: string
): SelectionComment | null {
  const [selectionComment, setSelectionComment] = useState<SelectionComment | null>(null);
  useEffect(() => {
    const update = (): void => {
      const selection = document.getSelection();
      const range = selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      const view = viewRef.current;
      const content = contentRef.current;
      if (range === null || view === null || content === null || rendered === null) {
        setSelectionComment(null);
        return;
      }
      const anchor = selectedPassage(content, rendered.documentText, documentPath, range);
      const end = range.getBoundingClientRect();
      const viewBox = view.getBoundingClientRect();
      setSelectionComment(
        anchor === null ? null : { anchor, left: end.right - viewBox.left, top: end.bottom - viewBox.top }
      );
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [contentRef, documentPath, rendered, viewRef]);
  return selectionComment;
}
````

`src/web/components/DocumentView/useHoveredBlock.ts`:

````ts
import type { RefObject } from "react";
import { useEffect, useState } from "react";

import { blockElementAt } from "../../anchoring/blockElementAt";

export interface HoveredBlock {
  index: number;

  /**
   * Where the block starts, relative to the view
   */
  top: number;
}

/**
 * Follows the block under the pointer, so the view can offer a comment on the whole block beside it
 *
 * @returns the block, or null when the pointer has left the view
 */
export function useHoveredBlock(
  viewRef: RefObject<HTMLElement | null>,
  contentRef: RefObject<HTMLElement | null>
): HoveredBlock | null {
  const [hoveredBlock, setHoveredBlock] = useState<HoveredBlock | null>(null);
  useEffect(() => {
    const view = viewRef.current;
    const content = contentRef.current;
    if (view === null || content === null) {
      return;
    }
    const enter = (event: MouseEvent): void => {
      const block = event.target instanceof Node ? blockElementAt(content, event.target) : null;
      if (block !== null) {
        const top = block.getBoundingClientRect().top - view.getBoundingClientRect().top;
        setHoveredBlock({ index: Number(block.getAttribute("data-md-block")), top });
      }
    };
    const leave = (): void => setHoveredBlock(null);
    content.addEventListener("mouseover", enter);
    view.addEventListener("mouseleave", leave);
    return () => {
      content.removeEventListener("mouseover", enter);
      view.removeEventListener("mouseleave", leave);
    };
  }, [contentRef, viewRef]);
  return hoveredBlock;
}
````

`src/web/components/DocumentView/useDocumentClicks.ts`:

````ts
import type { RefObject } from "react";
import { useEffect } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { offsetAtPoint } from "../../anchoring/offsetAtPoint";
import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";
import { threadAtOffset } from "../../review/threadAtOffset";

import type { RenderedDocument } from "./useRenderedDocument";

export interface DocumentClickHandlers {
  onNavigate: (pagePath: string) => void;
  onSelectThread: (threadId: number) => void;
}

/**
 * Handles clicks in the rendered doc: a link to a heading scrolls to it, a link to another doc shows that doc in the
 * page, and a click on highlighted text selects its thread
 *
 * @param highlightedThreads the threads whose passages are highlighted
 */
export function useDocumentClicks(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  highlightedThreads: readonly Thread[],
  { onNavigate, onSelectThread }: DocumentClickHandlers
): void {
  useEffect(() => {
    const content = contentRef.current;
    if (content === null || rendered === null) {
      return;
    }
    const click = (event: MouseEvent): void => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link !== null) {
        followLink(event, content, link.getAttribute("href") ?? "", onNavigate);
        return;
      }
      const offset =
        document.getSelection()?.isCollapsed === false
          ? null
          : offsetAtPoint(content, rendered.documentText, event.clientX, event.clientY);
      const thread = offset === null ? null : threadAtOffset(highlightedThreads, offset);
      if (thread !== null) {
        onSelectThread(thread.id);
      }
    };
    content.addEventListener("click", click);
    return () => content.removeEventListener("click", click);
  }, [contentRef, highlightedThreads, onNavigate, onSelectThread, rendered]);
}

/**
 * Scrolls to the heading a link such as "#retry-policy" names, and puts it in the page's address
 */
export function scrollToHeading(content: HTMLElement, hash: string): void {
  content.ownerDocument.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
  history.replaceState(history.state, "", hash);
}

function followLink(
  event: MouseEvent,
  content: HTMLElement,
  href: string,
  onNavigate: (pagePath: string) => void
): void {
  if (href.startsWith("#")) {
    event.preventDefault();
    scrollToHeading(content, href);
  } else if (href.startsWith("/document/") && isPlainLeftClick(event)) {
    event.preventDefault();
    onNavigate(href);
  }
}
````

`src/web/components/DocumentView/useRevealSelectedThread.ts`:

````ts
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { rangeForPassage } from "../../anchoring/rangeForPassage";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Scrolls the selected thread's passage into view once, when the user selects the thread or its doc first renders,
 * unless the passage is already on screen
 *
 * @param threads the doc's threads with a passage in the page
 */
export function useRevealSelectedThread(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  threads: readonly Thread[],
  selectedThreadId: number | null
): void {
  const revealedThreadId = useRef<number | null>(null);
  useEffect(() => {
    const content = contentRef.current;
    if (selectedThreadId === revealedThreadId.current || content === null || rendered === null) {
      return;
    }
    revealedThreadId.current = selectedThreadId;
    const range = passageRange(
      content,
      rendered,
      threads.find((thread) => thread.id === selectedThreadId)
    );
    if (range !== null && !isOnScreen(range.getBoundingClientRect())) {
      const start = range.startContainer;
      (start instanceof Element ? start : start.parentElement)?.scrollIntoView({ block: "center" });
    }
  }, [contentRef, rendered, selectedThreadId, threads]);
}

function passageRange(content: HTMLElement, rendered: RenderedDocument, thread: Thread | undefined): Range | null {
  const anchor = thread?.anchor;
  return anchor?.kind === "passage"
    ? rangeForPassage(content, rendered.documentText, anchor.startOffset, anchor.endOffset)
    : null;
}

function isOnScreen(box: DOMRect): boolean {
  return box.top >= 0 && box.bottom <= innerHeight;
}
````

`src/web/components/DocumentView/useScrollToHeading.ts`:

````ts
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import { scrollToHeading } from "./useDocumentClicks";
import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Scrolls to the heading the page's address names once the doc first renders, and not again when the doc renders
 * anew after an edit, which keeps the user's place
 *
 * @param hash the address's fragment, such as "#goals", or an empty string
 */
export function useScrollToHeading(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  documentPath: string,
  hash: string
): void {
  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    const content = contentRef.current;
    const heading = documentPath + hash;
    if (content === null || rendered === null || hash === "" || heading === scrolledTo.current) {
      return;
    }
    scrolledTo.current = heading;
    scrollToHeading(content, hash);
  }, [contentRef, documentPath, hash, rendered]);
}
````

`src/web/components/DocumentView/useDocumentNavigation.ts`:

````ts
import type { RefObject } from "react";

import type { Thread } from "../../../shared/review/threadSchema";

import { useDocumentClicks } from "./useDocumentClicks";
import type { RenderedDocument } from "./useRenderedDocument";
import { useRevealSelectedThread } from "./useRevealSelectedThread";
import { useScrollToHeading } from "./useScrollToHeading";

export interface DocumentNavigation {
  documentPath: string;

  /**
   * The page address's fragment, such as "#goals", or an empty string
   */
  hash: string;

  /**
   * The threads whose passages are highlighted
   */
  highlightedThreads: readonly Thread[];

  onNavigate: (pagePath: string) => void;
  onSelectThread: (threadId: number) => void;
  selectedThreadId: number | null;
}

/**
 * Moves around the rendered doc: follows its links, selects a thread from a click on its highlight, scrolls to the
 * heading the address names, and brings the selected thread's passage into view
 */
export function useDocumentNavigation(
  contentRef: RefObject<HTMLElement | null>,
  rendered: RenderedDocument | null,
  { documentPath, hash, highlightedThreads, onNavigate, onSelectThread, selectedThreadId }: DocumentNavigation
): void {
  useDocumentClicks(contentRef, rendered, highlightedThreads, { onNavigate, onSelectThread });
  useRevealSelectedThread(contentRef, rendered, highlightedThreads, selectedThreadId);
  useScrollToHeading(contentRef, rendered, documentPath, hash);
}
````

`src/web/components/DocumentView/useMermaidDiagrams.ts`:

````ts
import type { RefObject } from "react";
import { useEffect } from "react";

import { renderMermaidDiagrams } from "../../rendering/renderMermaidDiagrams";

import type { RenderedDocument } from "./useRenderedDocument";

/**
 * Draws the Mermaid diagrams of each new rendering of the doc once it is in the page
 */
export function useMermaidDiagrams(contentRef: RefObject<HTMLElement | null>, rendered: RenderedDocument | null): void {
  useEffect(() => {
    const content = contentRef.current;
    if (content !== null && rendered !== null) {
      renderMermaidDiagrams(content).catch((failure: unknown) => reportError(failure));
    }
  }, [contentRef, rendered]);
}
````

- [ ] **Step 5: Write the view**

The "Comment" button prevents its `mousedown` default, so clicking it does not clear the selection it is about to comment on:

`src/web/components/DocumentView/DocumentControls.tsx`:

````tsx
import { Button } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { blockPassage } from "../../anchoring/blockPassage";
import type { NewComment } from "../../review/NewComment";

import styles from "./DocumentView.module.css";
import type { HoveredBlock } from "./useHoveredBlock";
import type { RenderedDocument } from "./useRenderedDocument";
import type { SelectionComment } from "./useSelectionComment";
import type { ThreadMarker } from "./useThreadHighlights";

export interface DocumentControlsProps {
  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

  hoveredBlock: HoveredBlock | null;
  markers: ThreadMarker[];
  onComment: (newComment: NewComment) => void;
  onSelectThread: (threadId: number) => void;

  /**
   * The doc on the page, or null until it has rendered
   */
  rendered: RenderedDocument | null;

  selectedThreadId: number | null;
  selectionComment: SelectionComment | null;
}

/**
 * The buttons laid over the rendered doc: + beside the block under the pointer, a numbered marker beside each thread's
 * passage, and Comment beside the selected text
 */
export function DocumentControls({
  document: shown,
  hoveredBlock,
  markers,
  onComment,
  onSelectThread,
  rendered,
  selectedThreadId,
  selectionComment,
}: DocumentControlsProps): JSX.Element {
  const commentOnBlock = (blockIndex: number): void => {
    const anchor = rendered === null ? null : blockPassage(rendered.documentText, shown.path, blockIndex);
    if (anchor !== null) {
      onComment({ anchor, renderedHash: shown.hash });
    }
  };
  const commentOnSelection = ({ anchor }: SelectionComment): void => {
    onComment({ anchor, renderedHash: shown.hash });
    document.getSelection()?.removeAllRanges();
  };
  return (
    <>
      {hoveredBlock !== null && (
        <Button
          className={styles.blockButton}
          onClick={() => commentOnBlock(hoveredBlock.index)}
          size="sm"
          style={{ top: hoveredBlock.top }}
          variant="ghost"
          aria-label="Comment on this block"
          data-md-ignore=""
        >
          +
        </Button>
      )}
      {markers.map(({ column, threadId, top }) => (
        <Button
          className={styles.marker}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          size="sm"
          style={{ insetInlineEnd: `${column * 2}rem`, top }}
          variant={threadId === selectedThreadId ? "primary" : "secondary"}
          aria-label={`Thread #${threadId}`}
          aria-pressed={threadId === selectedThreadId}
          data-md-ignore=""
        >
          {threadId}
        </Button>
      ))}
      {selectionComment !== null && (
        <Button
          className={styles.selectionButton}
          onClick={() => commentOnSelection(selectionComment)}
          onMouseDown={(event) => event.preventDefault()}
          size="sm"
          style={{ left: selectionComment.left, top: selectionComment.top }}
          data-md-ignore=""
        >
          Comment
        </Button>
      )}
    </>
  );
}
````

`src/web/components/DocumentView/DocumentView.tsx`:

````tsx
import { Alert, Button, Prose, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useMemo, useRef } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import type { Thread } from "../../../shared/review/threadSchema";
import { isHighlighted } from "../../review/isHighlighted";
import type { NewComment } from "../../review/NewComment";

import { DocumentControls } from "./DocumentControls";
import styles from "./DocumentView.module.css";
import { useDocumentNavigation } from "./useDocumentNavigation";
import { useHoveredBlock } from "./useHoveredBlock";
import { useMermaidDiagrams } from "./useMermaidDiagrams";
import { useRenderedDocument } from "./useRenderedDocument";
import { useSelectionComment } from "./useSelectionComment";
import { useThreadHighlights } from "./useThreadHighlights";

export interface DocumentViewProps {
  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

  /**
   * The page address's fragment, such as "#goals", naming a heading to scroll to once the doc is shown
   */
  hash: string;

  /**
   * Called when the user starts a comment on a passage, a block or the whole doc
   */
  onComment: (newComment: NewComment) => void;

  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;

  /**
   * Called when the user clicks a highlighted passage or its marker
   */
  onSelectThread: (threadId: number) => void;

  selectedThreadId: number | null;

  /**
   * This doc's threads
   */
  threads: Thread[];
}

/**
 * The rendered doc, with its comments highlighted and marked, and the controls that start a new comment
 */
export function DocumentView({
  document: shown,
  hash,
  onComment,
  onNavigate,
  onSelectThread,
  selectedThreadId,
  threads,
}: DocumentViewProps): JSX.Element {
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const { error, rendered } = useRenderedDocument(shown);
  const highlightedThreads = useMemo(
    () => threads.filter((thread) => isHighlighted(thread, selectedThreadId)),
    [selectedThreadId, threads]
  );
  const markers = useThreadHighlights(viewRef, contentRef, rendered, highlightedThreads, selectedThreadId);
  const selectionComment = useSelectionComment(viewRef, contentRef, rendered, shown.path);
  const hoveredBlock = useHoveredBlock(viewRef, contentRef);
  useDocumentNavigation(contentRef, rendered, {
    documentPath: shown.path,
    hash,
    highlightedThreads,
    onNavigate,
    onSelectThread,
    selectedThreadId,
  });
  useMermaidDiagrams(contentRef, rendered);
  return (
    <Stack gap={3}>
      <Button
        className={styles.documentButton}
        onClick={() => onComment({ anchor: { document: shown.path, kind: "document" } })}
        size="sm"
        variant="ghost"
      >
        Comment on this doc
      </Button>
      {error !== null && (
        <Alert role="alert" title="The doc could not be shown" tone="danger">
          {error}
        </Alert>
      )}
      <div className={styles.view} ref={viewRef}>
        <Prose
          as="article"
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: rendered?.html ?? "" }}
          ref={contentRef}
          aria-label={shown.path}
        />
        <DocumentControls
          document={shown}
          hoveredBlock={hoveredBlock}
          markers={markers}
          onComment={onComment}
          onSelectThread={onSelectThread}
          rendered={rendered}
          selectedThreadId={selectedThreadId}
          selectionComment={selectionComment}
        />
      </div>
    </Stack>
  );
}
````

`src/web/components/DocumentView/DocumentView.module.css`:

````css
.documentButton {
  align-self: start;
}

.view {
  padding-inline: 2.5rem;
  position: relative;
}

.content {
  min-block-size: 50vh;
}

.content ::highlight(markdown-review-threads) {
  background-color: var(--sui-color-warning-subtle);
}

.content ::highlight(markdown-review-selected) {
  background-color: var(--sui-color-primary-subtle);
}

.blockButton,
.marker,
.selectionButton {
  position: absolute;
  user-select: none;
}

.blockButton {
  inset-inline-start: 0;
}

.selectionButton {
  z-index: 1;
}
````

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run --project web src/web/components/DocumentView`
Expected: PASS, 12 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 474 tests; fallow `warn`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Show the doc with its comments highlighted and marked, and start comments on text, blocks and the doc"
```

---

### Task 10: Put the page together

**Files:**
- Create: `src/web/navigation/documentPathOf.ts`, `src/web/navigation/usePageLocation.ts`, `src/web/review/countDrafts.ts`, `src/web/review/useThreads.ts`, `src/web/review/useDocumentSource.ts`, `src/web/api/useReviewEvents.ts`, `src/web/components/DocumentsPage/DocumentsPage.tsx`, `src/web/components/App/DocumentPane.tsx`, `src/web/components/App/App.module.css`
- Modify: `src/web/components/App/App.tsx`, `src/web/main.tsx`, `src/web/testing/standInForLayout.ts`
- Test: `src/web/components/App/App.test.tsx`

**Interfaces:**
- Consumes:
  - `createReviewApi`, `ReviewApiContext`, `useReviewApi`, `ReviewApiError` (Tasks 3 and 6); `TopBar`, `DocumentLinks`, `documentPagePath` (Task 8); `ThreadSidebar`, `NewComment` (Task 7); `DocumentView` (Task 9); `isRepositoryRelativePath` (plan 1).
- Produces:
  - `<App>`: StylesUI's `PageLayout` holding `TopBar`, then a `Sidebar` layout of the docs list or the doc beside the sticky `ThreadSidebar`.
    - It routes `/` to `DocumentsPage` and `/document/<path>` to `DocumentPane`.
    - It reads every thread and refetches them on `threads-changed`. It refetches the open doc on its `document-changed`, and everything when the event stream reconnects after dropping.
    - On `navigate` it moves to the path and fragment of the URL it is sent.
    - While the stream is down it shows "Lost the connection to the review server".
    - It lists store files that could not be read. Selecting a thread on another doc opens that doc.
  - `<DocumentPane documentPath hash onComment onNavigate onSelectThread selectedThreadId state threads>` shows "Loading …", "<path> was not found", "<path> could not be shown" or the `DocumentView`.
  - `<DocumentsPage onNavigate threads>`: `DocumentLinks` for the whole repo, read again whenever the threads change.
  - `usePageLocation(): PageNavigation` (`{ location: { hash, pathname }, navigate(pagePath) }`), which follows `popstate`. `navigate` pushes a history entry and scrolls to the top.
  - `documentPathOf(pathname): string | null` and `countDrafts(threads): number`.
  - `useThreads(api): ThreadsState` (`{ error, refresh, snapshot }`) and `useDocumentSource(api, documentPath): DocumentSourceState` (`{ refresh, state }`). `DocumentState` is `loaded`, `missing` or `failed`, and is null until the doc in `documentPath` is answered.
  - `useReviewEvents(api, handlers): ServerConnection` (`{ agentWaiting, isConnected }`), which subscribes once, through `useEffectEvent`.
  - `main.tsx` gives `App` the API from `createReviewApi()`. `standInForLayout.ts` gains a no-op `scrollTo`.

- [ ] **Step 1: Write the failing tests**

The App tests drive the whole page through the fake server, emitting its events the way the event stream would:

`src/web/testing/standInForLayout.ts`:

````ts
// jsdom lays nothing out, so it has no ResizeObserver, no geometry for ranges and no scrolling; these stand-ins let
// components that measure or scroll the page run, with every box empty and at the top left

class StandInResizeObserver {
  public disconnect(): void {}

  public observe(): void {}

  public unobserve(): void {}
}

Object.assign(globalThis, { ResizeObserver: StandInResizeObserver });

Range.prototype.getBoundingClientRect = () => new DOMRect();

Range.prototype.getClientRects = () => Object.assign([], { item: () => null });

Element.prototype.scrollIntoView = () => {};

globalThis.scrollTo = () => {};
````

`src/web/components/App/App.test.tsx`:

````tsx
import { render as renderBase, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread, testTime } from "../../../shared/review/testing/reviewBuilders";
import type { Thread } from "../../../shared/review/threadSchema";
import { ReviewApiContext } from "../../api/ReviewApiContext";
import { createFakeReviewApi } from "../../testing/createFakeReviewApi";

import { App } from "./App";

const plan = "# Plan\n\nWe cache results for **24h** today.\n\nRetries happen three times.\n";

const spec = "# Spec\n\nResults are cached.\n";

const planThread = buildThread({ anchor: buildPassageAnchor({ endOffset: 29, startOffset: 8 }), id: 1 });

const specThread = buildThread({
  anchor: buildPassageAnchor({
    anchoredText: "Results",
    document: "docs/spec.md",
    endOffset: 12,
    quote: "Results",
    startOffset: 5,
  }),
  id: 2,
});

describe("App", () => {
  test("must list the docs with comments when the page opens at its root", async () => {
    const { render } = setUpTest({ path: "/" });

    await render();

    expect(screen.getByRole("heading", { level: 1, name: "Docs" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "docs/plan.md 1 open, 0 drafts" })).toBeInTheDocument();
  });

  test("must show the doc and its threads when the page opens at the doc's address", async () => {
    const { render } = setUpTest();

    await render();

    expect(await elements.article().findByRole("heading", { level: 1, name: "Plan" })).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Thread #1" })).toBeInTheDocument();
  });

  test("must say the doc was not found when it no longer exists", async () => {
    const { render } = setUpTest({ path: "/document/docs/gone.md" });

    await render();

    expect(await screen.findByRole("alert")).toHaveTextContent("docs/gone.md was not found");
  });

  test("must show the doc the agent opens when the agent opens another doc", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });

    expect(await screen.findByRole("heading", { level: 1, name: "docs/spec.md" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/document/docs/spec.md");
  });

  test("must show a doc whose name has spaces and accents when the page opens at its address", async () => {
    const { render } = setUpTest({ path: "/document/docs/Design%20Notes%20caf%C3%A9.md" });

    await render();

    expect(await screen.findByRole("heading", { level: 1, name: "docs/Design Notes café.md" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Notes" })).toBeInTheDocument();
  });

  test("must show the doc the user came from when the user goes back", async () => {
    const { fake, render } = setUpTest();
    await render();
    fake.emit({ type: "navigate", url: "http://127.0.0.1:4321/document/docs/spec.md" });
    await screen.findByRole("heading", { level: 1, name: "docs/spec.md" });

    history.back();

    expect(await screen.findByRole("heading", { level: 1, name: "docs/plan.md" })).toBeInTheDocument();
  });

  test("must keep the user's unsent reply when the agent edits the doc and answers", async () => {
    const { documents, fake, render } = setUpTest();
    const user = userEvent.setup();
    await render();
    await user.click(screen.getByRole("button", { name: "Reply" }));
    await user.type(screen.getByRole("textbox", { name: "Reply" }), "Half written");

    documents["docs/plan.md"] = "# Plan\n\nWe cache results for 1h today.\n";
    fake.snapshot.threads[0]?.messages.push({ at: testTime, author: "agent", body: "Changed to 1h" });
    fake.emit({ document: "docs/plan.md", type: "document-changed" });
    fake.emit({ type: "threads-changed" });

    expect(await screen.findByText("Changed to 1h")).toBeInTheDocument();
    expect(await elements.article().findByText("We cache results for 1h today.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Half written");
  });

  test("must show the agent's reply when the server says the threads changed", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.snapshot.threads[0]?.messages.push({ at: testTime, author: "agent", body: "Changed to 1h" });
    fake.emit({ type: "threads-changed" });

    expect(await screen.findByText("Changed to 1h")).toBeInTheDocument();
  });

  test("must show the new text in place when the agent edits the doc", async () => {
    const { documents, fake, render } = setUpTest();
    await render();

    documents["docs/plan.md"] = "# Plan\n\nWe cache results for 1h today.\n";
    fake.emit({ document: "docs/plan.md", type: "document-changed" });

    expect(await elements.article().findByText("We cache results for 1h today.")).toBeInTheDocument();
  });

  test("must say the server cannot be reached while the connection is down, and read everything again when it is back", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.emit({ type: "disconnected" });
    const alert = await screen.findByRole("alert");
    fake.snapshot.threads.push(buildThread({ anchor: { document: "docs/plan.md", kind: "document" }, id: 3 }));
    fake.emit({ type: "connected" });

    expect(alert).toHaveTextContent("Lost the connection to the review server");
    expect(await screen.findByRole("article", { name: "Thread #3" })).toBeInTheDocument();
    expect(screen.queryByText("Lost the connection to the review server")).not.toBeInTheDocument();
  });

  test("must show that the agent is waiting when the server says a poll is open", async () => {
    const { fake, render } = setUpTest();
    await render();

    fake.emit({ agentWaiting: true, type: "presence" });

    expect(await screen.findByText("Agent waiting")).toBeInTheDocument();
  });

  test("must count the drafts on every doc on the submit button", async () => {
    const { render } = setUpTest({
      threads: [
        planThread,
        { ...specThread, draft: { at: testTime, body: "Cached where?" } },
        buildThread({
          anchor: { kind: "review" },
          draft: { at: testTime, body: "Overall?" },
          id: 3,
          messages: [],
          status: "draft",
        }),
      ],
    });

    await render();

    expect(await screen.findByRole("button", { name: "Submit (2)" })).toBeInTheDocument();
  });

  test("must save a comment on the selected text as a draft when the user writes one", async () => {
    const { render } = setUpTest({ threads: [] });
    const user = userEvent.setup();
    await render();
    await elements.article().findByText("Retries happen three times.");

    selectText(elements.article().getByText("Retries happen three times."), "Retries".length);
    await user.click(await screen.findByRole("button", { name: "Comment" }));
    await user.keyboard("Three is too many");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    const drafts = within(await screen.findByRole("region", { name: "Drafts" }));
    expect(drafts.getByRole("article", { name: "Thread #1" })).toHaveTextContent("Retries");
    expect(await screen.findByRole("button", { name: "Submit (1)" })).toBeInTheDocument();
  });

  test("must show the thread's doc when the user selects a thread on another doc", async () => {
    const { render } = setUpTest();
    const user = userEvent.setup();
    await render();

    await user.click(screen.getByRole("radio", { name: "All docs" }));
    await user.click(screen.getByRole("button", { name: "#2 Line 3" }));

    expect(await screen.findByRole("heading", { level: 1, name: "docs/spec.md" })).toBeInTheDocument();
  });
});

function setUpTest({
  path = "/document/docs/plan.md",
  threads = [planThread, specThread],
}: { path?: string; threads?: Thread[] } = {}) {
  localStorage.clear();
  history.pushState(null, "", path);
  const documents: Record<string, string> = {
    "docs/Design Notes café.md": "# Notes\n",
    "docs/plan.md": plan,
    "docs/spec.md": spec,
  };
  const fake = createFakeReviewApi({ documents, threads });
  const render = async (): Promise<void> => {
    renderBase(
      <ReviewApiContext value={fake.api}>
        <App />
      </ReviewApiContext>
    );
    await screen.findByRole("textbox", { name: "Comment on the whole review" });
  };
  return { documents, fake, render };
}

function selectText(element: HTMLElement, length: number): void {
  const text = element.firstChild ?? element;
  const range = document.createRange();
  range.setStart(text, 0);
  range.setEnd(text, length);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
}

const elements = {
  article: () => within(screen.getByRole("article", { name: "docs/plan.md" })),
};
````

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run --project web src/web/components/App`
Expected: FAIL, all 14 tests, with `Unable to find role="textbox" and name "Comment on the whole review"`, since `App` is still Task 1's placeholder.

- [ ] **Step 3: Write the page's state**

Each hook reads from the server again when a `refresh` bumps its revision. A reply that arrives after a newer request has started is dropped:

`src/web/navigation/documentPathOf.ts`:

````ts
import { isRepositoryRelativePath } from "../../shared/review/isRepositoryRelativePath";

/**
 * @param pathname the path of one of the app's pages
 * @returns the repo-relative path of the doc the page shows, or null for any other page
 */
export function documentPathOf(pathname: string): string | null {
  if (!pathname.startsWith("/document/")) {
    return null;
  }
  try {
    const document = pathname.slice("/document/".length).split("/").map(decodeURIComponent).join("/");
    return isRepositoryRelativePath(document) ? document : null;
  } catch {
    return null;
  }
}
````

`src/web/navigation/usePageLocation.ts`:

````ts
import { useCallback, useEffect, useState } from "react";

export interface PageLocation {
  /**
   * The address's fragment, such as "#goals", or an empty string
   */
  hash: string;

  pathname: string;
}

export interface PageNavigation {
  location: PageLocation;

  /**
   * Shows another page of the app without reloading, as a new entry in the browser's history
   *
   * @param pagePath the page's path, with any fragment
   */
  navigate: (pagePath: string) => void;
}

/**
 * Follows the page's address, including the browser's back and forward buttons
 */
export function usePageLocation(): PageNavigation {
  const [location, setLocation] = useState(readLocation);
  useEffect(() => {
    const update = (): void => setLocation(readLocation());
    addEventListener("popstate", update);
    return () => removeEventListener("popstate", update);
  }, []);
  const navigate = useCallback((pagePath: string): void => {
    history.pushState(null, "", pagePath);
    setLocation(readLocation());
    scrollTo(0, 0);
  }, []);
  return { location, navigate };
}

function readLocation(): PageLocation {
  return { hash: window.location.hash, pathname: window.location.pathname };
}
````

`src/web/review/countDrafts.ts`:

````ts
import type { Thread } from "../../shared/review/threadSchema";

/**
 * @returns how many new comments and replies the user has not yet submitted
 */
export function countDrafts(threads: readonly Thread[]): number {
  return threads.filter((thread) => thread.draft !== undefined).length;
}
````

`src/web/review/useThreads.ts`:

````ts
import { useCallback, useEffect, useState } from "react";

import type { ThreadsSnapshot } from "../../shared/api/apiResponseSchemas";
import { describeFailure } from "../api/describeFailure";
import type { ReviewApi } from "../api/ReviewApi";

export interface ThreadsState {
  error: string | null;

  /**
   * Reads the threads again
   */
  refresh: () => void;

  /**
   * Every thread in the repo and the review's state, or null until they are first read
   */
  snapshot: ThreadsSnapshot | null;
}

/**
 * Reads every thread in the repo, and again whenever asked
 */
export function useThreads(api: ReviewApi): ThreadsState {
  const [snapshot, setSnapshot] = useState<ThreadsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let isCurrent = true;
    api.readThreads().then(
      (next) => {
        if (isCurrent) {
          setSnapshot(next);
          setError(null);
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setError(describeFailure(failure));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [api, revision]);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  return { error, refresh, snapshot };
}
````

`src/web/review/useDocumentSource.ts`:

````ts
import { useCallback, useEffect, useState } from "react";

import type { DocumentSource } from "../../shared/api/apiResponseSchemas";
import { describeFailure } from "../api/describeFailure";
import type { ReviewApi } from "../api/ReviewApi";
import { ReviewApiError } from "../api/ReviewApiError";

export type DocumentState =
  | { kind: "loaded"; document: DocumentSource }
  | { kind: "missing"; path: string }
  | { kind: "failed"; message: string; path: string };

export interface DocumentSourceState {
  /**
   * Reads the doc again, keeping the current state until the new one arrives
   */
  refresh: () => void;

  /**
   * The last answer for the doc, or null until it arrives
   */
  state: DocumentState | null;
}

/**
 * Reads a doc's source from the server, again whenever the doc or a refresh asks for it
 *
 * @param documentPath the doc to read, or null to read none
 */
export function useDocumentSource(api: ReviewApi, documentPath: string | null): DocumentSourceState {
  const [state, setState] = useState<DocumentState | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (documentPath === null) {
      return;
    }
    let isCurrent = true;
    api.readDocument(documentPath).then(
      (document) => {
        if (isCurrent) {
          setState({ document, kind: "loaded" });
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setState(toFailedState(documentPath, failure));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [api, documentPath, revision]);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const isForDocument = state !== null && (state.kind === "loaded" ? state.document.path : state.path) === documentPath;
  return { refresh, state: isForDocument ? state : null };
}

function toFailedState(path: string, failure: unknown): DocumentState {
  return failure instanceof ReviewApiError && failure.reason === "missing-document"
    ? { kind: "missing", path }
    : { kind: "failed", message: describeFailure(failure), path };
}
````

`src/web/api/useReviewEvents.ts`:

````ts
import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { ReviewApi } from "./ReviewApi";
import type { ReviewEvent } from "./reviewEventSchema";

export interface ReviewEventHandlers {
  onDocumentChanged: (document: string) => void;

  /**
   * Called with the absolute address of the page the agent asked the tab to show
   */
  onNavigate: (url: string) => void;

  /**
   * Called when the connection comes back after dropping, when anything may have changed
   */
  onReconnected: () => void;

  onThreadsChanged: () => void;
}

export interface ServerConnection {
  agentWaiting: boolean;
  isConnected: boolean;
}

/**
 * Listens to the server's events for as long as the page is open
 *
 * @returns whether the agent is waiting for a submit, and whether the server can be reached
 */
export function useReviewEvents(api: ReviewApi, handlers: ReviewEventHandlers): ServerConnection {
  const [connection, setConnection] = useState<ServerConnection>({ agentWaiting: false, isConnected: true });
  const hasDropped = useRef(false);
  const handle = useEffectEvent((event: ReviewEvent): void => {
    switch (event.type) {
      case "presence":
        setConnection((current) => ({ ...current, agentWaiting: event.agentWaiting }));
        return;
      case "threads-changed":
        handlers.onThreadsChanged();
        return;
      case "document-changed":
        handlers.onDocumentChanged(event.document);
        return;
      case "navigate":
        handlers.onNavigate(event.url);
        return;
      case "connected":
        setConnection((current) => ({ ...current, isConnected: true }));
        if (hasDropped.current) {
          hasDropped.current = false;
          handlers.onReconnected();
        }
        return;
      case "disconnected":
        hasDropped.current = true;
        setConnection((current) => ({ ...current, isConnected: false }));
    }
  });
  useEffect(() => api.subscribe(handle), [api]);
  return connection;
}
````

- [ ] **Step 4: Write the page**

`src/web/components/DocumentsPage/DocumentsPage.tsx`:

````tsx
import { Alert } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useEffect, useState } from "react";

import type { DocumentList } from "../../../shared/api/apiResponseSchemas";
import type { Thread } from "../../../shared/review/threadSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { DocumentLinks } from "../DocumentLinks/DocumentLinks";

export interface DocumentsPageProps {
  onNavigate: (pagePath: string) => void;

  /**
   * Every thread in the repo; the page reads the list again when they change
   */
  threads: Thread[];
}

/**
 * The page the app shows at its root: the docs with comments and the docs opened recently
 */
export function DocumentsPage({ onNavigate, threads }: DocumentsPageProps): JSX.Element {
  const api = useReviewApi();
  const [list, setList] = useState<DocumentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    api.readDocuments().then(
      (next) => {
        if (isCurrent) {
          setList(next);
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setError(describeFailure(failure));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [api, threads]);
  return (
    <>
      {error !== null && (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      )}
      {list !== null && <DocumentLinks list={list} onNavigate={onNavigate} />}
    </>
  );
}
````

`src/web/components/App/DocumentPane.tsx`:

````tsx
import { Alert, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import type { NewComment } from "../../review/NewComment";
import type { DocumentState } from "../../review/useDocumentSource";
import { DocumentView } from "../DocumentView/DocumentView";

export interface DocumentPaneProps {
  documentPath: string;
  hash: string;
  onComment: (newComment: NewComment) => void;
  onNavigate: (pagePath: string) => void;
  onSelectThread: (threadId: number) => void;
  selectedThreadId: number | null;

  /**
   * The server's last answer for the doc, or null while it is being read
   */
  state: DocumentState | null;

  /**
   * This doc's threads
   */
  threads: Thread[];
}

/**
 * The doc on screen, or why it cannot be shown
 */
export function DocumentPane({ documentPath, state, ...viewProps }: DocumentPaneProps): JSX.Element {
  switch (state?.kind) {
    case undefined:
      return (
        <Text as="p" tone="muted">
          Loading {documentPath}…
        </Text>
      );
    case "missing":
      return (
        <Alert role="alert" title={`${documentPath} was not found`} tone="warning">
          It may have been renamed or deleted. Its comments are in the sidebar, under Outdated.
        </Alert>
      );
    case "failed":
      return (
        <Alert role="alert" title={`${documentPath} could not be shown`} tone="danger">
          {state.message}
        </Alert>
      );
    case "loaded":
      return <DocumentView document={state.document} {...viewProps} />;
  }
}
````

`src/web/components/App/App.tsx`:

````tsx
import { Alert, PageLayout, Sidebar, Stack, Theme } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useMemo, useState } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import type { Thread } from "../../../shared/review/threadSchema";
import { useReviewApi } from "../../api/useReviewApi";
import { useReviewEvents } from "../../api/useReviewEvents";
import { documentPagePath } from "../../navigation/documentPagePath";
import { documentPathOf } from "../../navigation/documentPathOf";
import { usePageLocation } from "../../navigation/usePageLocation";
import { countDrafts } from "../../review/countDrafts";
import type { NewComment } from "../../review/NewComment";
import { useDocumentSource } from "../../review/useDocumentSource";
import { useThreads } from "../../review/useThreads";
import { DocumentsPage } from "../DocumentsPage/DocumentsPage";
import { ThreadSidebar } from "../ThreadSidebar/ThreadSidebar";
import { TopBar } from "../TopBar/TopBar";

import styles from "./App.module.css";
import { DocumentPane } from "./DocumentPane";

const unrequestedReview: ReviewState = { approved: false, approvedAt: null, requestedAt: null };

/**
 * The review page: the docs list or a doc, the comments beside it, and the bar across the top
 */
export function App(): JSX.Element {
  const api = useReviewApi();
  const { location, navigate } = usePageLocation();
  const documentPath = documentPathOf(location.pathname);
  const threads = useThreads(api);
  const documentSource = useDocumentSource(api, documentPath);
  const [selectedThreadId, setSelectedThreadId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState<NewComment | null>(null);
  const connection = useReviewEvents(api, {
    onDocumentChanged: (document) => {
      if (document === documentPath) {
        documentSource.refresh();
      }
    },
    onNavigate: (url) => {
      const page = new URL(url);
      navigate(page.pathname + page.hash);
    },
    onReconnected: () => {
      threads.refresh();
      documentSource.refresh();
    },
    onThreadsChanged: threads.refresh,
  });
  const allThreads = useMemo(() => threads.snapshot?.threads ?? [], [threads.snapshot]);
  const documentThreads = useMemo(
    () => allThreads.filter(({ anchor }) => anchor.kind !== "review" && anchor.document === documentPath),
    [allThreads, documentPath]
  );
  const problems = [...(threads.error === null ? [] : [threads.error]), ...(threads.snapshot?.problems ?? [])];
  const selectThread = (thread: Thread): void => {
    setSelectedThreadId(thread.id);
    if (thread.anchor.kind !== "review" && thread.anchor.document !== documentPath) {
      navigate(documentPagePath(thread.anchor.document));
    }
  };
  return (
    <Theme mode="system">
      <PageLayout>
        <TopBar
          agentWaiting={connection.agentWaiting}
          documentPath={documentPath}
          draftCount={countDrafts(allThreads)}
          onNavigate={navigate}
          onSubmitted={threads.refresh}
          review={threads.snapshot?.review ?? unrequestedReview}
        />
        <Sidebar align="start" as="main" className={styles.main} sideWidth="24rem">
          <Stack gap={3}>
            {!connection.isConnected && (
              <Alert role="alert" title="Lost the connection to the review server" tone="warning">
                Trying again. If the server has stopped, ask the agent to run <code>markdown-review open</code>, which
                starts it again.
              </Alert>
            )}
            {problems.length > 0 && (
              <Alert title="Some comments could not be read" tone="danger">
                {problems.join(" ")}
              </Alert>
            )}
            {documentPath === null ? (
              <DocumentsPage onNavigate={navigate} threads={allThreads} />
            ) : (
              <DocumentPane
                documentPath={documentPath}
                hash={location.hash}
                onComment={setNewComment}
                onNavigate={navigate}
                onSelectThread={setSelectedThreadId}
                selectedThreadId={selectedThreadId}
                state={documentSource.state}
                threads={documentThreads}
              />
            )}
          </Stack>
          <div className={styles.sidebar}>
            <ThreadSidebar
              documentPath={documentPath}
              newComment={newComment}
              onChanged={threads.refresh}
              onCloseNewComment={() => setNewComment(null)}
              onSelectThread={selectThread}
              selectedThreadId={selectedThreadId}
              threads={allThreads}
            />
          </div>
        </Sidebar>
      </PageLayout>
    </Theme>
  );
}
````

`src/web/components/App/App.module.css`:

````css
.main {
  padding: var(--sui-space-4);
}

.sidebar {
  max-block-size: 100dvh;
  overflow-y: auto;
  position: sticky;
  top: 0;
}
````

`src/web/main.tsx`:

````tsx
import "@krelborn/stylesui/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { createReviewApi } from "./api/createReviewApi";
import { ReviewApiContext } from "./api/ReviewApiContext";
import { App } from "./components/App/App";
import "./global.css";

const rootElement = document.getElementById("root");
if (rootElement === null) {
  throw new Error("The page has no #root element");
}

createRoot(rootElement).render(
  <StrictMode>
    <ReviewApiContext value={createReviewApi()}>
      <App />
    </ReviewApiContext>
  </StrictMode>
);
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project web src/web/components/App`
Expected: PASS, 14 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 487 tests; fallow `warn`.

- [ ] **Step 6: Try it in a browser**

Run `pnpm build`. Then, in any git repository with a markdown doc, run `node <this repo>/dist/cli.js open <doc.md>`.
Expected: the browser shows the doc with the sidebar. Selecting text offers Comment, and saving it puts a draft in the sidebar and highlights the text. The browser's console shows no errors. Run `node <this repo>/dist/cli.js stop` afterwards.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Put the page together: the docs list or a doc, the comments beside it, and live updates from the server"
```

---

### Task 11: The skill and install-skill

**Files:**
- Create: `skills/markdown-review/SKILL.md`, `src/cli/rawMarkdownImports.d.ts`, `src/cli/commands/installSkillCommand.ts`, `src/integration/installSkill.integration.test.ts`
- Modify: `src/cli/runCli.ts`, `src/cli/helpText.ts`, `AGENTS.md`
- Test: `src/cli/runCli.test.ts`, `src/integration/installSkill.integration.test.ts`

**Interfaces:**
- Consumes:
  - `runCli`'s command table, `helpText`, `CliContext`/`CliTerminal` (plan 2); `findRoot` (plan 2); `readTextFileOrNull` (plan 1); `setUpReviewRepository` (plan 2).
- Produces:
  - `skills/markdown-review/SKILL.md`, in Agent Skills format: front matter with `name` and `description`, then the loop, approval, the shell time limits from spec section 8, and `--help`.
  - `markdown-review install-skill [--global]` writes that file, bundled into `dist/cli.js` through `?raw`.
    - It writes to `<root>/.claude/skills/markdown-review/SKILL.md`, or `$HOME/.claude/skills/markdown-review/SKILL.md` with `--global`.
    - It prints `Installed`, `Updated` or `Reinstalled the markdown-review skill at <path>` and a `next_step`.
  - `installSkillCommand(args, context): Promise<number>`. `src/cli/rawMarkdownImports.d.ts` declares `*.md?raw` for the server's tsconfig.
  - `runCli.test.ts`'s `setUpTest` gives the terminal a `HOME` and returns `home`.

- [ ] **Step 1: Write the skill**

Write the skill first, because the tests compare installed files with it:

`skills/markdown-review/SKILL.md`:

````markdown
---
name: markdown-review
description: Hands markdown docs you wrote, such as plans, specs and design notes, to the user to review in their browser, then reads their comments back so you can edit the docs and answer each one. Use when the user asks you to have a doc reviewed, or when a doc you wrote needs their sign-off before you carry on.
---

# Markdown Review

The user reviews your markdown in a browser and comments on passages, blocks, whole docs or the review as a whole. You read the comments with the `markdown-review` command, edit the docs, and answer each comment.

If the `markdown-review` command is not found, install it with `npm install --global @krelborn/markdown-review`.

## The review loop

1. Run `markdown-review open <doc.md>`. It starts a review round and shows the doc in the user's browser.
2. Run `markdown-review poll`. It waits until the user submits, then prints each comment: its thread ID, file, line range, the quoted text and the user's words.
   - Give the shell command a timeout of at least 600000 ms. `poll` gives up after 540 seconds by default; run it again if it says there are no comments yet.
   - In Claude Code, run it with `run_in_background` and `--timeout 7080`, and a Bash timeout of 7200000 ms. A submit still ends it at once.
3. Edit the docs. Then answer every thread:
   - `markdown-review resolve <id> "<what changed>"` when you have addressed it.
   - `markdown-review reply <id> "<question>"` when you need the user's input.
   - For a long message, put it in a file and pass `--file <path>`, or pass `--file -` and write it to standard input.
4. Run `markdown-review poll` again for the next round.

`markdown-review inbox` prints what `poll` would, without waiting, for picking comments up later.

## Approval

The review ends when the user approves it, and `poll` and `inbox` then start with "Review approved". Address any comments that came with the approval, then carry on with your task. Do not run `poll` again for that review.

## Good to know

- A quote is the text as the browser shows it, not the markdown source. The line range is exact, so use it to find the passage.
- If `poll` is stopped before the user submits, nothing is lost: run it again.
- Every command ends with a `next_step` line that says what to do next. `markdown-review --help` lists the commands.
- Run `markdown-review stop` to stop the review server when you have finished.
````

`src/cli/rawMarkdownImports.d.ts`:

````ts
declare module "*.md?raw" {
  const content: string;
  export default content;
}
````

- [ ] **Step 2: Write the failing tests**

In `runCli.test.ts`, import the skill, give the terminal a `HOME`, and add three tests at the end of the `describe`:

`src/cli/runCli.test.ts`, changed as this diff shows:

````diff
--- a/src/cli/runCli.test.ts
+++ b/src/cli/runCli.test.ts
@@ -1,9 +1,10 @@
 import { execFile } from "node:child_process";
-import { mkdir, realpath, writeFile } from "node:fs/promises";
+import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
 import path from "node:path";
 import { promisify } from "node:util";
 import { afterEach, describe, expect, test, vi } from "vitest";
 
+import skill from "../../skills/markdown-review/SKILL.md?raw";
 import { createMemoryLogger } from "../server/logging/testing/createMemoryLogger";
 import { packageVersion } from "../server/runtime/packageVersion";
 import type { RunningServer } from "../server/runtime/runServer";
@@ -172,6 +173,40 @@ describe("runCli", () => {
     expect(exitCode).toBe(1);
     expect(stderr).toContain("is not a file inside the repository");
   });
+
+  test("must install the skill in the repository's skills directory when the agent installs it", async () => {
+    const { root, run } = await setUpTest();
+    const skillPath = path.join(root, ".claude", "skills", "markdown-review", "SKILL.md");
+
+    const { exitCode, stdout } = await run(["install-skill"]);
+
+    expect(exitCode).toBe(0);
+    expect(stdout).toBe(
+      `Installed the markdown-review skill at ${skillPath}\n\n` +
+        "next_step: The skill loads when an agent session starts. To start a review now, run `markdown-review open <doc.md>`.\n"
+    );
+    expect(await readFile(skillPath, "utf8")).toBe(skill);
+  });
+
+  test("must install the skill in the user's skills directory when the agent installs it with --global", async () => {
+    const { home, run } = await setUpTest();
+
+    await run(["install-skill", "--global"]);
+
+    expect(await readFile(path.join(home, ".claude", "skills", "markdown-review", "SKILL.md"), "utf8")).toBe(skill);
+  });
+
+  test("must replace the skill and say so when an older version is installed", async () => {
+    const { root, run } = await setUpTest();
+    const skillPath = path.join(root, ".claude", "skills", "markdown-review", "SKILL.md");
+    await mkdir(path.dirname(skillPath), { recursive: true });
+    await writeFile(skillPath, "---\nname: markdown-review\n---\n");
+
+    const { stdout } = await run(["install-skill"]);
+
+    expect(stdout.startsWith(`Updated the markdown-review skill at ${skillPath}\n`)).toBe(true);
+    expect(await readFile(skillPath, "utf8")).toBe(skill);
+  });
 });
 
 interface SetUpOptions {
@@ -181,6 +216,7 @@ interface SetUpOptions {
 
 async function setUpTest({ inGit = true, withServer = false }: SetUpOptions = {}) {
   const root = path.join(await realpath(getDirectory()), "repo");
+  const home = path.join(await realpath(getDirectory()), "home");
   await mkdir(path.join(root, "docs"), { recursive: true });
   if (inGit) {
     await runCommand("git", ["init", "-q"], { cwd: root });
@@ -200,7 +236,7 @@ async function setUpTest({ inGit = true, withServer = false }: SetUpOptions = {}
       cliPath: path.join(root, "unused-cli.js"),
       terminal: {
         workingDirectory: root,
-        env: { MARKDOWN_REVIEW_NO_BROWSER: "1" },
+        env: { HOME: home, MARKDOWN_REVIEW_NO_BROWSER: "1" },
         readStdin: async () => "",
         stderr: (text) => {
           stderr += text;
@@ -217,5 +253,5 @@ async function setUpTest({ inGit = true, withServer = false }: SetUpOptions = {}
     const exitCode = await started.exitCode;
     return { exitCode, stderr: started.stderr(), stdout: started.stdout() };
   };
-  return { root, run, start };
+  return { home, root, run, start };
 }
````

The integration test checks that the built CLI carries the skill:

`src/integration/installSkill.integration.test.ts`:

````ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import skill from "../../skills/markdown-review/SKILL.md?raw";

import { setUpReviewRepository } from "./testing/setUpReviewRepository";

const getRepository = setUpReviewRepository();

describe("install-skill", () => {
  test("must write the skill the package was built with when the agent installs it", async () => {
    const repository = getRepository();

    const { exitCode } = await repository.run(["install-skill"]);

    const skillPath = path.join(repository.root, ".claude", "skills", "markdown-review", "SKILL.md");
    expect(exitCode).toBe(0);
    expect(await readFile(skillPath, "utf8")).toBe(skill);
  });
});
````

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run --project node src/cli/runCli.test.ts`
Expected: FAIL, 3 tests. The command is unknown (`expected 2 to be +0`), the global file is never written (`ENOENT`), and `expected false to be true` for "Updated".

- [ ] **Step 4: Add the command**

`src/cli/commands/installSkillCommand.ts`:

````ts
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import skill from "../../../skills/markdown-review/SKILL.md?raw";
import { readTextFileOrNull } from "../../server/files/readTextFileOrNull";
import type { CliContext } from "../CliContext";
import { findRoot } from "../findRoot";

/**
 * Writes the skill that teaches agents the review workflow where Claude Code and OpenCode look for skills
 */
export async function installSkillCommand(args: string[], { terminal }: CliContext): Promise<number> {
  const { values } = parseArgs({ args, options: { global: { type: "boolean" } } });
  const base = values.global === true ? (terminal.env.HOME ?? os.homedir()) : await findRoot(terminal.workingDirectory);
  const skillPath = path.join(base, ".claude", "skills", "markdown-review", "SKILL.md");
  const installed = await readTextFileOrNull(skillPath);
  await mkdir(path.dirname(skillPath), { recursive: true });
  await writeFile(skillPath, skill);
  const outcome = installed === null ? "Installed" : installed === skill ? "Reinstalled" : "Updated";
  terminal.stdout(
    `${outcome} the markdown-review skill at ${skillPath}\n\n` +
      "next_step: The skill loads when an agent session starts. To start a review now, run `markdown-review open <doc.md>`.\n"
  );
  return 0;
}
````

`src/cli/runCli.ts`:

````ts
import { packageVersion } from "../server/runtime/packageVersion";

import type { CliContext } from "./CliContext";
import { CliError } from "./CliError";
import { replyCommand, resolveCommand } from "./commands/agentThreadCommands";
import { inboxCommand } from "./commands/inboxCommand";
import { installSkillCommand } from "./commands/installSkillCommand";
import { openCommand } from "./commands/openCommand";
import { pollCommand } from "./commands/pollCommand";
import { serveCommand } from "./commands/serveCommand";
import { stopCommand } from "./commands/stopCommand";
import { helpText } from "./helpText";
import { ServerRequestError } from "./ServerRequestError";

type Command = (args: string[], context: CliContext) => Promise<number>;

const commands: Record<string, Command> = {
  inbox: inboxCommand,
  "install-skill": installSkillCommand,
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

`src/cli/helpText.ts`:

````ts
const commandHelp: Record<string, string> = {
  inbox: [
    "markdown-review inbox [--document <path>]",
    "  Print whether the review is approved and the threads that need you, then return at once.",
  ].join("\n"),
  "install-skill": [
    "markdown-review install-skill [--global]",
    "  Install the skill that teaches agents this workflow in this repository's .claude/skills, or with --global in",
    "  ~/.claude/skills. Claude Code and OpenCode both read skills from there.",
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

`AGENTS.md`:

````markdown
# AGENTS.md

Markdown Review: a local tool for reviewing agent-written markdown in a browser and handing the comments back to the coding agent through a CLI. The design is `docs/superpowers/specs/2026-10-08-markdown-review-design.md`; the build plans are in `docs/superpowers/plans/`.

## Commands

- `pnpm build`: build the CLI and server into `dist/cli.js`, and the web app into `dist/web/`, which the server serves
- `pnpm test`: all tests: the `node` project (`src/cli`, `src/server`, `src/shared`), the `web` project in jsdom (`src/web`), and the `integration` project, which builds `dist/cli.js` first and runs it as separate processes against temporary git repositories
- `pnpm test:coverage`: tests with v8 coverage, written to `coverage/istanbul.json`
- `pnpm verify`: lint, format check, typecheck and tests
- Try the agent loop by hand: `pnpm build`, then in any git repository run `node <this repo>/dist/cli.js open <doc.md>`, `inbox`, `poll`, `reply`, `resolve`, `stop` and `install-skill`. Set `MARKDOWN_REVIEW_NO_BROWSER=1` to keep `open` from launching a browser.

## Layout

- `src/shared/`: code the server and the browser both run: the markdown-it configuration, blocks and canonical text, and the zod schemas of the review model. No Node or DOM APIs.
- `src/server/`: the anchorer and the review store; `http/` holds the Hono app (agent routes, browser routes, poll, event stream, repo files, app shell) and `runtime/` runs it as the per-repo server process.
- `src/cli/`: the agent's CLI. `main.ts` is the bin entry; the CLI starts the server by running itself as `serve --root <root>`, detached.
- `src/integration/`: tests that drive the built CLI the way an agent does.
- `skills/markdown-review/SKILL.md`: the skill that teaches agents the review loop. The build bundles it into `dist/cli.js`, and `install-skill` writes that copy.
- `src/web/`: the React app the server serves, built with `vite.web.config.mts` from `src/web/index.html`. `components/` holds one folder per component; `rendering/` holds the walk that reads canonical text from rendered blocks, and the conformance test that checks it against `src/shared`.

## Protocol

`protocolVersion` in `src/shared/api/protocolVersion.ts` versions the HTTP API and the store format together. Bump it for any change an older CLI or server could not handle: the CLI replaces a server of an older protocol and refuses to touch one of a newer protocol. `server.json` and `GET /api/health` are how every version finds that protocol, so they may gain fields but must keep the ones they have.

## Anchoring

Comments anchor to offsets in a doc's canonical text, which `parseBlocks` computes from markdown-it tokens and the browser reads back from the rendered page with `layOutBlockText`. The two must agree exactly: run the `web` project's conformance test after any change to `createMarkdownIt`, the markdown plugins, Shiki or DOMPurify, and add a case to `src/web/rendering/testing/conformanceCorpus.md` for any new kind of content.

Install dependencies with `pnpm add` and no hand-written version, then run `pnpm format`, which sorts `package.json`. `@krelborn/stylesui` comes from GitHub Packages, and `.npmrc` reads a token with `read:packages` from `GITHUB_TOKEN`, so run pnpm as `GITHUB_TOKEN=$(gh auth token) pnpm install`.

## Fallow

fallow is a devDependency; run it as `pnpm exec fallow`. Its skill is `node_modules/fallow/skills/fallow/SKILL.md`.

- The husky pre-commit hook runs `fallow audit` on every commit after the first. A `fail` verdict blocks the commit: fix the findings it reports. Only findings the commit introduces count, so every new export must be used by code or tests in the same commit.
- The commit check estimates test coverage from which tests import a function. For exact CRAP scores run `pnpm test:coverage`, then `pnpm exec fallow health --coverage coverage/istanbul.json`.
- To refresh the skill pointers and MCP config after upgrading fallow, run `pnpm exec fallow agent install --harness claude --harness codex --without guide --without hooks`.
````

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run --project node src/cli/runCli.test.ts`
Expected: PASS, 20 tests.

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 491 tests, `install-skill.integration` among them; fallow `warn`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Teach agents the review loop with a skill, and install it with install-skill"
```

---

### Task 12: End-to-end tests in real browsers

**Files:**
- Create: `src/integration/testing/createGitRepository.ts`, `src/integration/testing/startCli.ts`, `src/integration/testing/stopReviewServer.ts`, `playwright.config.ts`, `tsconfig.e2e.json`, `src/e2e/testing/buildPackage.ts`, `src/e2e/testing/reviewTest.ts`, `src/e2e/review.e2e.ts`
- Modify: `package.json`, `src/integration/testing/setUpReviewRepository.ts`, `tsconfig.json`, `.gitignore`, `.github/workflows/ci.yml`, `AGENTS.md`
- Test: `src/e2e/review.e2e.ts`

**Interfaces:**
- Consumes:
  - The integration helpers of plan 2 (`setUpReviewRepository`, `serverFileSchema`); the built package (Task 1); everything the user and the agent do in Tasks 4 to 11.
- Produces:
  - `createGitRepository(documents): Promise<string>`, `startCli(root, args, input?): RunningCli`, `CliResult` and `RunningCli`, and `stopReviewServer(root): Promise<void>`. These move out of `setUpReviewRepository.ts`, which keeps its API, so the end-to-end tests can share them.
  - `pnpm test:e2e` runs `playwright test`. Its global setup builds `dist/cli.js` and `dist/web/`, and it runs `src/e2e/**/*.e2e.ts` in Chromium and WebKit.
  - The `review` fixture (`test` in `src/e2e/testing/reviewTest.ts`) gives each test a fresh git repository holding `docs/plan.md` and `docs/spec.md`. It offers `open(document)`, `run(args)`, `startPoll()` and `writeDocument(document, source)`, and it fails the test if the page logs an error.
  - `writeDraftComment(page, from, through, body)`, `submitDrafts(page, draftCount, verdict)` and `highlightedText(page)`.
  - The five spec section 14 scenarios:
    - select text, draft and submit, and `poll` returns the comment;
    - the agent edits the doc and the highlight follows the text;
    - `resolve` moves the thread to Resolved;
    - Approve ends the agent's poll;
    - a relative link opens the linked doc, without reloading the page.

- [ ] **Step 1: Install Playwright and its browsers**

```bash
pnpm add -D @playwright/test
pnpm format
pnpm exec playwright install chromium webkit
```

- [ ] **Step 2: Share the integration tests' helpers**

The end-to-end tests need the same temporary repository, CLI runner and server stop as the integration tests, without Vitest's hooks:

`src/integration/testing/createGitRepository.ts`:

````ts
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const runCommand = promisify(execFile);

/**
 * Creates a git repository in a new temporary directory, holding the given docs
 *
 * @param documents each doc's source, by repo-relative path
 * @returns the repository's root, with symbolic links resolved as git resolves them
 */
export async function createGitRepository(documents: Record<string, string>): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "markdown-review-test-")));
  for (const [document, source] of Object.entries(documents)) {
    const filePath = path.join(root, ...document.split("/"));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, source);
  }
  await runCommand("git", ["init", "-q"], { cwd: root });
  return root;
}
````

`src/integration/testing/startCli.ts`:

````ts
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../../../dist/cli.js", import.meta.url));

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

/**
 * Runs the built CLI in a directory the way an agent's shell does, with `MARKDOWN_REVIEW_NO_BROWSER` set
 *
 * @param root the directory to run it in
 * @param args the arguments after the program name
 * @param input what the command reads from standard input
 */
export function startCli(root: string, args: string[], input = ""): RunningCli {
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
  child.stdin.end(input);
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
}
````

`src/integration/testing/stopReviewServer.ts`:

````ts
import { readFile } from "node:fs/promises";
import path from "node:path";

import { serverFileSchema } from "../../server/runtime/serverFileSchema";

import { startCli } from "./startCli";

/**
 * Stops a test repository's review server with the CLI, and kills it if it is still running afterwards
 *
 * @param root the repository's root
 */
export async function stopReviewServer(root: string): Promise<void> {
  await startCli(root, ["stop"]).result;
  const recorded = await readFile(path.join(root, ".markdown-review", "server.json"), "utf8")
    .then((contents) => serverFileSchema.parse(JSON.parse(contents)))
    .catch(() => null);
  if (recorded !== null && recorded.pid !== process.pid) {
    try {
      process.kill(recorded.pid);
    } catch {
      return;
    }
  }
}
````

`src/integration/testing/setUpReviewRepository.ts`:

````ts
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";

import type { ServerFile } from "../../server/runtime/serverFileSchema";
import { serverFileSchema } from "../../server/runtime/serverFileSchema";

import { createGitRepository } from "./createGitRepository";
import type { CliResult, RunningCli } from "./startCli";
import { startCli } from "./startCli";
import { stopReviewServer } from "./stopReviewServer";

export const plan = "# Plan\n\nWe cache results for 24h.\n\nRetries happen three times.\n";

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

  beforeEach(async () => {
    repository = createRepository(await createGitRepository({ "docs/plan.md": plan }));
  });

  afterEach(async () => {
    if (repository !== undefined) {
      await stopReviewServer(repository.root);
      await rm(repository.root, { force: true, recursive: true });
    }
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
    run: (args, input) => startCli(root, args, input).result,
    start: (args) => startCli(root, args),
    writeDocument: (document, source) => writeFile(path.join(root, ...document.split("/")), source),
  };
}
````

Run: `pnpm vitest run --project integration`
Expected: PASS, 15 tests, as before.

- [ ] **Step 3: Configure Playwright**

In `package.json`, add the script (then run `pnpm format`):

```json
"test:e2e": "playwright test"
```

The end-to-end code reads DOM types inside `page.evaluate` and Node types outside it, so it has a tsconfig of its own:

`playwright.config.ts`:

````ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  forbidOnly: process.env.CI !== undefined,
  globalSetup: "./src/e2e/testing/buildPackage.ts",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  reporter: process.env.CI === undefined ? "list" : "github",
  testDir: "src/e2e",
  testMatch: "**/*.e2e.ts",
});
````

`tsconfig.e2e.json`:

````json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.e2e.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
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
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/e2e", "playwright.config.ts"]
}
````

`tsconfig.json`:

````json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.server.json" },
    { "path": "./tsconfig.e2e.json" },
    { "path": "./tsconfig.web.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
````

`src/e2e/testing/buildPackage.ts`:

````ts
import { fileURLToPath } from "node:url";

import { build } from "vite";

/**
 * Builds the CLI and the web app once before the end-to-end tests, which run the package as a user would
 */
export default async function buildPackage(): Promise<void> {
  for (const config of ["vite.config.mts", "vite.web.config.mts"]) {
    await build({ configFile: fileURLToPath(new URL(`../../../${config}`, import.meta.url)), logLevel: "warn" });
  }
}
````

- [ ] **Step 4: Write the end-to-end tests**

The fixture keeps the page's console errors from the test itself, before it stops the server: stopping the server drops the page's event stream, which the browser logs as an error.

`src/e2e/testing/reviewTest.ts`:

````ts
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "@playwright/test";
import { test as base, expect } from "@playwright/test";

import { createGitRepository } from "../../integration/testing/createGitRepository";
import type { CliResult, RunningCli } from "../../integration/testing/startCli";
import { startCli } from "../../integration/testing/startCli";
import { stopReviewServer } from "../../integration/testing/stopReviewServer";

export const plan = [
  "# Plan",
  "",
  "We cache results for **24h** today. See the [spec](spec.md#goals).",
  "",
  "Retries happen three times.",
  "",
].join("\n");

const spec = "# Spec\n\n## Goals\n\nResults are cached.\n";

export interface ReviewFixture {
  /**
   * Runs the agent's `open` for the doc and shows the page it prints in the browser
   */
  open(document: string): Promise<void>;

  root: string;
  run(args: string[]): Promise<CliResult>;

  /**
   * Starts the agent's `poll` and waits until the page says the agent is waiting
   */
  startPoll(): Promise<RunningCli>;

  writeDocument(document: string, source: string): Promise<void>;
}

/**
 * Playwright's test, given a fresh git repository holding `docs/plan.md` and `docs/spec.md` and the CLI to review it
 * with; a test fails if the page logs an error, such as a Content Security Policy violation
 */
export const test = base.extend<{ review: ReviewFixture }>({
  review: async ({ page }, runTest) => {
    const root = await createGitRepository({ "docs/plan.md": plan, "docs/spec.md": spec });
    const errors = collectErrors(page);
    await runTest({
      open: async (document) => {
        const { stdout } = await startCli(root, ["open", document]).result;
        await page.goto(stdout.slice(stdout.indexOf("http"), stdout.indexOf("\n")));
        await expect(page.getByRole("heading", { level: 1, name: document })).toBeVisible();
      },
      root,
      run: (args) => startCli(root, args).result,
      startPoll: async () => {
        const poll = startCli(root, ["poll", "--timeout", "60"]);
        await expect(page.getByRole("status")).toHaveText("Agent waiting");
        return poll;
      },
      writeDocument: (document, source) => writeFile(path.join(root, ...document.split("/")), source),
    });
    const errorsDuringTest = [...errors];
    await stopReviewServer(root);
    await rm(root, { force: true, recursive: true });
    expect(errorsDuringTest).toEqual([]);
  },
});

/**
 * Selects text in the doc on the page, as dragging across it would
 *
 * @param from the text the selection starts with
 * @param through the text it ends with, which may be in a later element
 */
async function selectText(page: Page, from: string, through: string): Promise<void> {
  await page.getByRole("article", { name: "docs/plan.md" }).evaluate(
    (article, { endText, startText }) => {
      const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let hasStart = false;
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const data = node.textContent ?? "";
        if (!hasStart && data.includes(startText)) {
          range.setStart(node, data.indexOf(startText));
          hasStart = true;
        }
        if (hasStart && data.includes(endText)) {
          range.setEnd(node, data.indexOf(endText) + endText.length);
          getSelection()?.removeAllRanges();
          getSelection()?.addRange(range);
          return;
        }
      }
      throw new Error(`The doc has no text from "${startText}" through "${endText}"`);
    },
    { endText: through, startText: from }
  );
}

/**
 * Comments on text in the doc the way the user does, and saves the comment as a draft
 *
 * @param from the text the comment's passage starts with
 * @param through the text it ends with
 * @param body the comment
 */
export async function writeDraftComment(page: Page, from: string, through: string, body: string): Promise<void> {
  await selectText(page, from, through);
  await page.getByRole("button", { exact: true, name: "Comment" }).click();
  await page.keyboard.type(body);
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByRole("region", { name: "Drafts" })).toBeVisible();
}

/**
 * Submits the user's drafts from the top bar
 *
 * @param draftCount how many drafts the submit button counts
 * @param verdict the menu's button for the verdict
 */
export async function submitDrafts(
  page: Page,
  draftCount: number,
  verdict: "Approve" | "Request changes"
): Promise<void> {
  await page.getByRole("button", { name: `Submit (${draftCount})` }).click();
  await page.getByRole("button", { name: verdict }).click();
}

/**
 * @returns the text of each passage the page highlights as a thread
 */
export function highlightedText(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...(CSS.highlights.get("markdown-review-threads") ?? [])].map((range) => range.toString())
  );
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}
````

`src/e2e/review.e2e.ts`:

````ts
import { expect } from "@playwright/test";

import { highlightedText, plan, submitDrafts, test, writeDraftComment } from "./testing/reviewTest";

test("must hand the user's comment to the agent's waiting poll when the user submits it", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const poll = await review.startPoll();

  await writeDraftComment(page, "cache", "24h", "Why 24h?");
  await submitDrafts(page, 1, "Request changes");

  const { exitCode, stdout } = await poll.result;
  expect(exitCode).toBe(0);
  expect(stdout).toContain('#1 docs/plan.md:3\n  quote: "cache results for 24h"\n  user: Why 24h?');
});

test("must keep the highlight on the commented text when the agent edits the doc above it", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "cache", "24h", "Why 24h?");

  await review.writeDocument("docs/plan.md", plan.replace("# Plan\n", "# Plan\n\nAn introduction the agent added.\n"));

  await expect(page.getByRole("button", { name: "#1 Line 5" })).toBeVisible();
  await expect(page.getByText("An introduction the agent added.")).toBeVisible();
  expect(await highlightedText(page)).toEqual(["cache results for 24h"]);
});

test("must move the thread to Resolved and show the agent's note when the agent resolves it", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await writeDraftComment(page, "Retries", "times.", "Make it configurable");
  await submitDrafts(page, 1, "Request changes");
  await expect(page.getByRole("region", { name: "Open" })).toBeVisible();

  await review.run(["resolve", "1", "Added a retries setting"]);

  const resolved = page.getByRole("region", { name: "Resolved" });
  await resolved.getByText("Resolved (1)").click();
  await expect(resolved.getByRole("article", { name: "Thread #1" })).toContainText("Added a retries setting");
  await expect(page.getByRole("region", { name: "Open" })).toBeHidden();
});

test("must end the agent's poll when the user approves the review", async ({ page, review }) => {
  await review.open("docs/plan.md");
  const poll = await review.startPoll();

  await submitDrafts(page, 0, "Approve");

  const { stdout } = await poll.result;
  expect(stdout.startsWith("Review approved. No threads need you.\n")).toBe(true);
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
});

test("must open the linked doc without reloading the page when the user follows a relative link", async ({
  page,
  review,
}) => {
  await review.open("docs/plan.md");
  await page.evaluate(() => Object.assign(window, { loadedBeforeTheLink: true }));

  await page.getByRole("link", { name: "spec" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "docs/spec.md" })).toBeVisible();
  expect(await page.evaluate(() => "loadedBeforeTheLink" in window)).toBe(true);
  await expect(page).toHaveURL((url) => url.pathname + url.hash === "/document/docs/spec.md#goals");
  await expect(page.getByRole("heading", { level: 2, name: "Goals" })).toBeInViewport();
});
````

- [ ] **Step 5: Run the end-to-end tests**

Run: `pnpm test:e2e`
Expected: PASS, 10 tests: the 5 scenarios in Chromium and in WebKit. These test features earlier tasks built, so they pass when first written. To see them fail, break a feature and run them again:
- Remove `pointLinksAtReview(template.content, documentPath);` from `renderDocument.ts`. The relative-link scenario then fails in both browsers, because the link reloads the page.
- Make `isHighlighted` return `false`. The highlight scenario then fails in both browsers.

Put both back.

- [ ] **Step 6: Ignore Playwright's output, and run the tests in CI**

`.gitignore`:

````text
node_modules/
dist/
coverage/
*.log
*.tsbuildinfo
.DS_Store
.superpowers/
playwright-report/
test-results/
````

`.github/workflows/ci.yml`:

````yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read
  packages: read

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      # .npmrc reads it to install @krelborn/stylesui from GitHub Packages
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm exec playwright install --with-deps chromium webkit

      - run: pnpm lint
      - run: pnpm format:check
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm test:e2e
````

`AGENTS.md`:

````markdown
# AGENTS.md

Markdown Review: a local tool for reviewing agent-written markdown in a browser and handing the comments back to the coding agent through a CLI. The design is `docs/superpowers/specs/2026-10-08-markdown-review-design.md`; the build plans are in `docs/superpowers/plans/`.

## Commands

- `pnpm build`: build the CLI and server into `dist/cli.js`, and the web app into `dist/web/`, which the server serves
- `pnpm test`: all tests: the `node` project (`src/cli`, `src/server`, `src/shared`), the `web` project in jsdom (`src/web`), and the `integration` project, which builds `dist/cli.js` first and runs it as separate processes against temporary git repositories
- `pnpm test:e2e`: Playwright end-to-end tests in Chromium and WebKit. They build the package first, then run the CLI and the web app together against temporary git repositories. Install the browsers once with `pnpm exec playwright install chromium webkit`.
- `pnpm test:coverage`: tests with v8 coverage, written to `coverage/istanbul.json`
- `pnpm verify`: lint, format check, typecheck and tests
- Try the agent loop by hand: `pnpm build`, then in any git repository run `node <this repo>/dist/cli.js open <doc.md>`, `inbox`, `poll`, `reply`, `resolve`, `stop` and `install-skill`. Set `MARKDOWN_REVIEW_NO_BROWSER=1` to keep `open` from launching a browser.

## Layout

- `src/shared/`: code the server and the browser both run: the markdown-it configuration, blocks and canonical text, and the zod schemas of the review model. No Node or DOM APIs.
- `src/server/`: the anchorer and the review store; `http/` holds the Hono app (agent routes, browser routes, poll, event stream, repo files, app shell) and `runtime/` runs it as the per-repo server process.
- `src/cli/`: the agent's CLI. `main.ts` is the bin entry; the CLI starts the server by running itself as `serve --root <root>`, detached.
- `src/integration/`: tests that drive the built CLI the way an agent does.
- `src/e2e/`: Playwright tests in which a user reviews in the browser while the CLI plays the agent.
- `skills/markdown-review/SKILL.md`: the skill that teaches agents the review loop. The build bundles it into `dist/cli.js`, and `install-skill` writes that copy.
- `src/web/`: the React app the server serves, built with `vite.web.config.mts` from `src/web/index.html`. `components/` holds one folder per component; `rendering/` holds the walk that reads canonical text from rendered blocks, and the conformance test that checks it against `src/shared`.

## Protocol

`protocolVersion` in `src/shared/api/protocolVersion.ts` versions the HTTP API and the store format together. Bump it for any change an older CLI or server could not handle: the CLI replaces a server of an older protocol and refuses to touch one of a newer protocol. `server.json` and `GET /api/health` are how every version finds that protocol, so they may gain fields but must keep the ones they have.

## Anchoring

Comments anchor to offsets in a doc's canonical text, which `parseBlocks` computes from markdown-it tokens and the browser reads back from the rendered page with `layOutBlockText`. The two must agree exactly: run the `web` project's conformance test after any change to `createMarkdownIt`, the markdown plugins, Shiki or DOMPurify, and add a case to `src/web/rendering/testing/conformanceCorpus.md` for any new kind of content.

Install dependencies with `pnpm add` and no hand-written version, then run `pnpm format`, which sorts `package.json`. `@krelborn/stylesui` comes from GitHub Packages, and `.npmrc` reads a token with `read:packages` from `GITHUB_TOKEN`, so run pnpm as `GITHUB_TOKEN=$(gh auth token) pnpm install`.

## Fallow

fallow is a devDependency; run it as `pnpm exec fallow`. Its skill is `node_modules/fallow/skills/fallow/SKILL.md`.

- The husky pre-commit hook runs `fallow audit` on every commit after the first. A `fail` verdict blocks the commit: fix the findings it reports. Only findings the commit introduces count, so every new export must be used by code or tests in the same commit.
- The commit check estimates test coverage from which tests import a function. For exact CRAP scores run `pnpm test:coverage`, then `pnpm exec fallow health --coverage coverage/istanbul.json`.
- To refresh the skill pointers and MCP config after upgrading fallow, run `pnpm exec fallow agent install --harness claude --harness codex --without guide --without hooks`.
````

- [ ] **Step 7: Run the whole check**

Run: `pnpm verify`, then `pnpm exec fallow audit`
Expected: clean with 491 tests; fallow `warn`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Test the review end to end in Chromium and WebKit, with the CLI as the agent"
```

---

## After the last task

- [ ] Run `pnpm verify`, `pnpm test:e2e` and `pnpm exec fallow audit`. Expected: 491 tests pass, the 10 end-to-end tests pass, and fallow's verdict is `warn`, only for the browser devDependencies.
- [ ] Use superpowers:finishing-a-development-branch. Nothing is pushed yet: ask the user before pushing to `Krelborn/markdown-review`. CI will not install StylesUI until the `@krelborn/stylesui` package grants this repository read access (see the notes above).
