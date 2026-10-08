import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../../../dist/cli.js", import.meta.url));

export interface CliResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

export interface RunningCli {
  child: ChildProcess;
  result: Promise<CliResult>;

  /**
   * Resolves once the command has written `text` to standard error
   */
  printedToStderr(text: string): Promise<void>;
}

/**
 * Runs the built CLI in a directory the way an agent's shell does, with `MARKDOWN_REVIEW_NO_BROWSER` set
 *
 * @param root the directory to run it in
 * @param args the arguments after the program name
 * @param input what the command reads from standard input
 */
export function startCli(root: string, args: string[], input = ""): RunningCli {
  const child = spawn(process.execPath, [cliPath, ...args], {
    cwd: root,
    env: { ...process.env, MARKDOWN_REVIEW_NO_BROWSER: "1" },
  });
  let stdout = "";
  let stderr = "";
  const stderrWaiters: { resolve: () => void; text: string }[] = [];
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
    for (const waiter of stderrWaiters.filter(({ text }) => stderr.includes(text))) {
      waiter.resolve();
    }
  });
  child.stdin.end(input);
  const result = new Promise<CliResult>((resolve) => {
    child.on("close", (exitCode) => resolve({ exitCode, stderr, stdout }));
  });
  const printedToStderr = (text: string): Promise<void> =>
    new Promise((resolve) => {
      if (stderr.includes(text)) {
        resolve();
        return;
      }
      stderrWaiters.push({ resolve, text });
    });
  return { child, printedToStderr, result };
}
