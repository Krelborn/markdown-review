import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Server } from "node:http";
import { createServer } from "node:http";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { packageVersion } from "../server/runtime/packageVersion";

import { setUpReviewRepository } from "./testing/setUpReviewRepository";
import { startCli } from "./testing/startCli";

const getRepository = setUpReviewRepository();

let registry: Server | undefined;

afterEach(async () => {
  await new Promise((resolve) => registry?.close(resolve) ?? resolve(undefined));
  registry = undefined;
});

describe("update check", () => {
  test("must offer the registry's newer version once the user approves the review", async () => {
    const repository = getRepository();
    const env = {
      CI: "",
      MARKDOWN_REVIEW_NO_UPDATE_CHECK: "",
      MARKDOWN_REVIEW_REGISTRY_URL: await startRegistry(),
      NO_UPDATE_NOTIFIER: "",
    };
    await startCli(repository.root, ["open", "docs/plan.md"], "", env).result;
    await vi.waitFor(async () => {
      expect(await readFile(cachePath(repository.root), "utf8")).toContain("99.0.0");
    });

    const opened = await startCli(repository.root, ["open", "docs/plan.md"], "", env).result;
    await repository.browser("POST", "/api/submit", { verdict: "go-ahead" });
    const inbox = await startCli(repository.root, ["inbox"], "", env).result;

    expect(opened.stdout).toContain(
      `update_available: markdown-review 99.0.0 is out; this is ${packageVersion}. Tell the user, and offer to ` +
        "update once they approve the review.\n"
    );
    expect(inbox.stdout).toContain(
      `update_available: markdown-review 99.0.0 is out; this is ${packageVersion}. Ask the user whether to update. ` +
        "If they agree, run `npm install --global @krelborn/markdown-review@latest`, then `markdown-review stop`.\n"
    );
  });

  test("must hold the update commands back from poll and inbox until the user approves", async () => {
    const repository = getRepository();
    const env = {
      CI: "",
      MARKDOWN_REVIEW_NO_UPDATE_CHECK: "",
      MARKDOWN_REVIEW_REGISTRY_URL: await startRegistry(),
      NO_UPDATE_NOTIFIER: "",
    };
    await startCli(repository.root, ["open", "docs/plan.md"], "", env).result;
    await vi.waitFor(async () => {
      expect(await readFile(cachePath(repository.root), "utf8")).toContain("99.0.0");
    });
    await repository.browser("POST", "/api/threads", { anchor: { kind: "review" }, body: "Overall?" });
    await repository.browser("POST", "/api/submit", { verdict: "revise" });

    const poll = await startCli(repository.root, ["poll", "--timeout", "5"], "", env).result;
    const inbox = await startCli(repository.root, ["inbox"], "", env).result;

    expect(poll.stdout).toContain("user: Overall?");
    expect(poll.stdout).not.toContain("update_available");
    expect(inbox.stdout).not.toContain("update_available");
  });

  test("must not ask the registry when update checks are off", async () => {
    const repository = getRepository();
    const requests: string[] = [];
    const url = await startRegistry(requests);

    await startCli(repository.root, ["open", "docs/plan.md"], "", { MARKDOWN_REVIEW_REGISTRY_URL: url }).result;
    await repository.browser("GET", "/api/update");

    expect(requests).toEqual([]);
  });

  test("must tell the agent to refresh the skill when the repo's copy is from another version", async () => {
    const repository = getRepository();
    const skillPath = path.join(repository.root, ".claude", "skills", "markdown-review", "SKILL.md");
    await mkdir(path.dirname(skillPath), { recursive: true });
    await writeFile(skillPath, "# An older skill\n");

    const { stdout } = await repository.run(["open", "docs/plan.md"]);

    expect(stdout).toContain(
      `skill_outdated: The markdown-review skill at ${skillPath} is older than this version (${packageVersion}). ` +
        "Once the user approves the review, run `markdown-review install-skill`."
    );
  });
});

function cachePath(root: string): string {
  return path.join(root, ".home", ".cache", "markdown-review", "update-check.json");
}

/**
 * Starts a stand-in npm registry whose dist-tags say 99.0.0 is the latest version
 *
 * @param requests where to record the path of each request
 * @returns the registry's URL
 */
async function startRegistry(requests: string[] = []): Promise<string> {
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ latest: "99.0.0" }));
  });
  registry = server;
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new TypeError("The stand-in registry is not listening on a TCP port");
  }
  return `http://127.0.0.1:${address.port}`;
}
