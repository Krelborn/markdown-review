import type { Logger } from "../Logger";

export interface LogEntry {
  error?: unknown;
  level: "error" | "info" | "warn";
  message: string;
}

export interface MemoryLogger {
  entries: LogEntry[];
  logger: Logger;
}

export function createMemoryLogger(): MemoryLogger {
  const entries: LogEntry[] = [];
  const logger: Logger = {
    error: (message, error) => {
      entries.push({ error, level: "error", message });
    },
    info: (message) => {
      entries.push({ level: "info", message });
    },
    warn: (message, error) => {
      entries.push({ error, level: "warn", message });
    },
  };
  return { entries, logger };
}
