import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { updateResponseSchema } from "../../shared/api/apiResponseSchemas";
import { createMemoryLogger } from "../logging/testing/createMemoryLogger";
import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";
import { UpdateChecker } from "../update/UpdateChecker";

import { setUpAppTest } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

describe("updateRoutes", () => {
  test("must offer the newer version and its install command when the update check has found one", async () => {
    const { cachePath, updateChecker } = setUpTest();
    await writeFile(cachePath, JSON.stringify({ checkedAt: new Date().toISOString(), distTags: { latest: "9.0.0" } }));
    const { browser } = await setUpAppTest(getDirectory(), { updateChecker });

    const update = updateResponseSchema.parse(await (await browser("GET", "/api/update")).json());

    expect(update).toEqual({
      availableVersion: "9.0.0",
      command: "npm install --global @krelborn/markdown-review@latest",
    });
  });

  test("must wait for the check in progress when the page asks as the server starts", async () => {
    const { updateChecker } = setUpTest();
    const { browser } = await setUpAppTest(getDirectory(), { updateChecker });
    void updateChecker.check();

    const update = updateResponseSchema.parse(await (await browser("GET", "/api/update")).json());

    expect(update.availableVersion).toBe("9.0.0");
  });

  test("must install the next tag when the newer version is a pre-release from it", async () => {
    const { cachePath, updateChecker } = setUpTest();
    await writeFile(
      cachePath,
      JSON.stringify({ checkedAt: new Date().toISOString(), distTags: { latest: "0.0.0-test", next: "9.0.0-beta.1" } })
    );
    const { browser } = await setUpAppTest(getDirectory(), { updateChecker });

    const update = updateResponseSchema.parse(await (await browser("GET", "/api/update")).json());

    expect(update).toEqual({
      availableVersion: "9.0.0-beta.1",
      command: "npm install --global @krelborn/markdown-review@next",
    });
  });

  test("must offer the newer version without a command when markdown-review runs through npx", async () => {
    const { cachePath, updateChecker } = setUpTest();
    await writeFile(cachePath, JSON.stringify({ checkedAt: new Date().toISOString(), distTags: { latest: "9.0.0" } }));
    const { browser } = await setUpAppTest(getDirectory(), { installKind: "npx", updateChecker });

    const update = updateResponseSchema.parse(await (await browser("GET", "/api/update")).json());

    expect(update).toEqual({ availableVersion: "9.0.0", command: null });
  });

  test.each([
    { condition: "the running version is the latest", latest: "0.0.0-test" },
    { condition: "nothing has been recorded", latest: null },
  ])("must offer nothing when $condition", async ({ latest }) => {
    const { cachePath, updateChecker } = setUpTest();
    if (latest !== null) {
      await writeFile(cachePath, JSON.stringify({ checkedAt: new Date().toISOString(), distTags: { latest } }));
    }
    const { browser } = await setUpAppTest(getDirectory(), { updateChecker });

    const update = updateResponseSchema.parse(await (await browser("GET", "/api/update")).json());

    expect(update).toEqual({ availableVersion: null, command: null });
  });

  test("must offer nothing when update checks are off", async () => {
    const { browser } = await setUpAppTest(getDirectory(), { updateChecker: null });

    const update = updateResponseSchema.parse(await (await browser("GET", "/api/update")).json());

    expect(update).toEqual({ availableVersion: null, command: null });
  });
});

function setUpTest() {
  const cachePath = path.join(getDirectory(), "update-check.json");
  const updateChecker = new UpdateChecker({
    cachePath,
    fetch: async () => Response.json({ latest: "9.0.0" }),
    logger: createMemoryLogger().logger,
    registry: "https://registry.test",
  });
  return { cachePath, updateChecker };
}
