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
