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
