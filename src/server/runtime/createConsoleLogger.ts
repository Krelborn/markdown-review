import type { Logger } from "../logging/Logger";

/**
 * Creates the server process's logger; the CLI points the process's output at `.markdown-review/server.log`
 *
 * @returns a logger that writes one timestamped line per entry
 */
export function createConsoleLogger(): Logger {
  const write = (level: string, message: string, error?: unknown): void => {
    const detail =
      error === undefined ? "" : ` ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`;
    process.stdout.write(`${new Date().toISOString()} ${level} ${message}${detail}\n`);
  };
  return {
    error: (message, error) => write("error", message, error),
    info: (message) => write("info", message),
    warn: (message, error) => write("warn", message, error),
  };
}
