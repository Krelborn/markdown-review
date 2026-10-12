import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { createMemoryLogger } from "../logging/testing/createMemoryLogger";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { readUpdateCheckFile } from "./readUpdateCheckFile";
import { UpdateChecker } from "./UpdateChecker";

const getDirectory = setUpTemporaryDirectory();

const now = new Date("2026-10-12T12:00:00.000Z");

const hoursBefore = (hours: number): string => new Date(now.getTime() - hours * 60 * 60_000).toISOString();

describe("UpdateChecker", () => {
  test("must record the registry's dist-tags when there is no cache", async () => {
    const { cachePath, checker, requested } = setUpTest({ answer: { latest: "0.4.0", other: "1.0.0" } });

    await checker.check();

    expect(requested).toEqual(["https://registry.test/-/package/%40krelborn%2Fmarkdown-review/dist-tags"]);
    expect(await readUpdateCheckFile(cachePath)).toEqual({
      checkedAt: now.toISOString(),
      distTags: { latest: "0.4.0" },
    });
  });

  test("must not ask the registry when the cache is less than a day old", async () => {
    const { cachePath, checker, requested } = setUpTest({ answer: { latest: "0.5.0" } });
    await writeCache(cachePath, hoursBefore(23), { latest: "0.4.0" });

    await checker.check();

    expect(requested).toEqual([]);
    expect(await checker.distTags()).toEqual({ latest: "0.4.0" });
  });

  test("must ask the registry again when the cache is a day old", async () => {
    const { cachePath, checker } = setUpTest({ answer: { latest: "0.5.0" } });
    await writeCache(cachePath, hoursBefore(24), { latest: "0.4.0" });

    await checker.check();

    expect(await checker.distTags()).toEqual({ latest: "0.5.0" });
  });

  test.each([
    { answer: new Response("{}", { status: 401 }), condition: "the registry answers with an error" },
    { answer: { latest: 4 }, condition: "the registry's answer is not dist-tags" },
    { answer: new TypeError("fetch failed"), condition: "the request fails" },
  ])("must keep the cached tags and wait a day when $condition", async ({ answer }) => {
    const { cachePath, checker, entries } = setUpTest({ answer });
    await writeCache(cachePath, hoursBefore(30), { latest: "0.4.0" });

    await checker.check();

    expect(await readUpdateCheckFile(cachePath)).toEqual({
      checkedAt: now.toISOString(),
      distTags: { latest: "0.4.0" },
    });
    expect(entries.map(({ level, message }) => ({ level, message }))).toEqual([
      { level: "warn", message: "Could not check the npm registry for a newer markdown-review" },
    ]);
  });

  test("must give up when the registry takes longer than the timeout", async () => {
    const { cachePath, checker } = setUpTest({ answer: "never" });

    await checker.check();

    expect(await readUpdateCheckFile(cachePath)).toEqual({ checkedAt: now.toISOString(), distTags: {} });
  });

  test("must wait for a check in progress when asked for the dist-tags", async () => {
    const { checker } = setUpTest({ answer: { latest: "0.4.0" } });

    void checker.check();

    expect(await checker.distTags()).toEqual({ latest: "0.4.0" });
  });

  test("must report no dist-tags when nothing has been recorded", async () => {
    const { checker } = setUpTest({ answer: "never" });

    expect(await checker.distTags()).toEqual({});
  });
});

async function writeCache(cachePath: string, checkedAt: string, distTags: Record<string, string>): Promise<void> {
  await writeFile(cachePath, JSON.stringify({ checkedAt, distTags }));
}

type Answer = Record<string, unknown> | Response | Error | "never";

function setUpTest({ answer }: { answer: Answer }) {
  const cachePath = path.join(getDirectory(), "update-check.json");
  const { entries, logger } = createMemoryLogger();
  const requested: string[] = [];
  const fakeFetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    requested.push(String(input));
    if (answer === "never") {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    }
    if (answer instanceof Error) {
      throw answer;
    }
    return answer instanceof Response ? answer : Response.json(answer);
  };
  const checker = new UpdateChecker({
    cachePath,
    fetch: fakeFetch,
    logger,
    now: () => now,
    registry: "https://registry.test",
    timeoutMilliseconds: 20,
  });
  return { cachePath, checker, entries, requested };
}
