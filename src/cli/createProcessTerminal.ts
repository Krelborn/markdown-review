import type { CliTerminal } from "./CliTerminal";

/**
 * Connects a CLI invocation to this process's working directory, environment and standard streams
 */
export function createProcessTerminal(): CliTerminal {
  return {
    workingDirectory: process.cwd(),
    env: process.env,
    readStdin: async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(Buffer.from(chunk));
      }
      return Buffer.concat(chunks).toString("utf8");
    },
    stderr: (text) => {
      process.stderr.write(text);
    },
    stdout: (text) => {
      process.stdout.write(text);
    },
  };
}
