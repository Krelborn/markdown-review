import { describe, expect, test } from "vitest";

import { registryUrl, updateCheckFilePath, updateChecksDisabled } from "./updateCheckSettings";

describe("updateCheckSettings", () => {
  test("must keep the cache under XDG_CACHE_HOME when it is set", () => {
    expect(updateCheckFilePath({ HOME: "/home/someone", XDG_CACHE_HOME: "/var/cache/someone" })).toBe(
      "/var/cache/someone/markdown-review/update-check.json"
    );
  });

  test.each([
    { condition: "XDG_CACHE_HOME is not set", env: { HOME: "/home/someone" } },
    { condition: "XDG_CACHE_HOME is relative", env: { HOME: "/home/someone", XDG_CACHE_HOME: "cache" } },
  ])("must keep the cache under ~/.cache when $condition", ({ env }) => {
    expect(updateCheckFilePath(env)).toBe("/home/someone/.cache/markdown-review/update-check.json");
  });

  test("must ask the public npm registry when no registry is set", () => {
    expect(registryUrl({})).toBe("https://registry.npmjs.org");
  });

  test("must ask the registry in MARKDOWN_REVIEW_REGISTRY_URL without its trailing slash when it is set", () => {
    expect(registryUrl({ MARKDOWN_REVIEW_REGISTRY_URL: "http://127.0.0.1:4873/" })).toBe("http://127.0.0.1:4873");
  });

  test.each([
    { disabled: false, env: {} },
    { disabled: true, env: { MARKDOWN_REVIEW_NO_UPDATE_CHECK: "1" } },
    { disabled: false, env: { MARKDOWN_REVIEW_NO_UPDATE_CHECK: "0" } },
    { disabled: true, env: { NO_UPDATE_NOTIFIER: "1" } },
    { disabled: true, env: { CI: "true" } },
    { disabled: false, env: { CI: "" } },
  ])("must report $disabled for whether checks are off when the environment is $env", ({ disabled, env }) => {
    expect(updateChecksDisabled(env)).toBe(disabled);
  });
});
