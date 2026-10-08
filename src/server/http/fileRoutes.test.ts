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

  test.each(["docs/evil.js", "docs/evil.css"])(
    "must serve %s as plain bytes when a page loads it from the repo, so it cannot run as the app's own code",
    async (file) => {
      const { request, root } = await setUpAppTest(getDirectory());
      await writeFile(path.join(root, ...file.split("/")), "fetch('/api/submit')\n");

      const response = await request("GET", `/files/${file}`, {});

      expect(response.headers.get("content-type")).toBe("application/octet-stream");
    }
  );

  test("must refuse a file when a symlink in the repo leads out of it", async () => {
    const { request, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(getDirectory(), "secret.txt"), "secret\n");
    await symlink(path.join(getDirectory(), "secret.txt"), path.join(root, "docs", "secret.txt"));

    expect((await request("GET", "/files/docs/secret.txt", {})).status).toBe(403);
  });

  test("must refuse the server's token file when a request asks for a file in the review store", async () => {
    const { request, root } = await setUpAppTest(getDirectory());
    await writeFile(path.join(root, ".markdown-review", "server.json"), JSON.stringify({ token: "secret" }));

    const response = await request("GET", "/files/.markdown-review/server.json", {});

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { reason: "private-file" } });
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
