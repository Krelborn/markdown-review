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
