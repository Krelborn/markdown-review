import { execFile } from "node:child_process";
import { connect } from "node:net";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const run = promisify(execFile);

/** Resolves true when the connection opens, false when it fails or times out. */
const canConnect = (options: { host: string; port: number } | { path: string }, timeoutMs?: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect(options);
    const finish = (opened: boolean) => {
      socket.destroy();
      resolve(opened);
    };
    if (timeoutMs !== undefined) {
      socket.setTimeout(timeoutMs);
    }
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });

describe("sandbox probe: each attempt must fail", () => {
  it("cannot read /Users/matt/.ssh", async () => {
    await expect(readdir("/Users/matt/.ssh")).rejects.toThrow();
  });

  it("cannot read the orc-github keychain item", async () => {
    await expect(run("security", ["find-generic-password", "-s", "orc-github"])).rejects.toThrow();
  });

  it.each(["192.168.1.54", "192.168.64.1"])(
    "cannot open a TCP connection to %s port 3773",
    async (host) => {
      expect(await canConnect({ host, port: 3773 }, 3000)).toBe(false);
    },
    10_000
  );

  it("cannot fetch https://github.com through the proxy", async () => {
    await expect(run("curl", ["--silent", "--show-error", "--max-time", "10", "https://github.com"])).rejects.toThrow();
  }, 20_000);

  it("cannot connect to the orcristd socket", async () => {
    expect(await canConnect({ path: "/Users/matt/orcrist/orcristd.sock" })).toBe(false);
  });
});
