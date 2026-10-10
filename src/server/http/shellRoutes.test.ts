import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

import { setUpTemporaryDirectory } from "../testing/setUpTemporaryDirectory";

import { setUpAppTest, testAppScript, testShellHtml } from "./testing/setUpAppTest";

const getDirectory = setUpTemporaryDirectory();

const testLicences = "# Licenses\n\n## react - 19.3.0 (MIT)\n";

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

  test("must serve the third-party licences as plain text when the page links to them", async () => {
    const { request, webDirectory } = await setUpAppTest(getDirectory());
    await writeFile(path.join(webDirectory, "licences.md"), testLicences);

    const response = await request("GET", "/licences", {});

    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": "text/plain; charset=UTF-8",
      "x-content-type-options": "nosniff",
    });
    expect(await response.text()).toBe(testLicences);
  });

  test("must answer that the licences are missing when the build has none", async () => {
    const { request } = await setUpAppTest(getDirectory());

    const response = await request("GET", "/licences", {});

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { reason: "missing-file" } });
  });

  test("must say the web app is missing when the build has none", async () => {
    const { request, webDirectory } = await setUpAppTest(getDirectory());
    await rm(path.join(webDirectory, "index.html"));

    const response = await request("GET", "/", {});

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { reason: "missing-web-app" } });
  });
});
