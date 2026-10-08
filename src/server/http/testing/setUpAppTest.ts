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
