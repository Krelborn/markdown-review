import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CliTerminal } from "./CliTerminal";

/**
 * Reads a reply or resolve message from the command's words or from `--file`
 *
 * @param words the words after the thread ID
 * @param file the `--file` option: a path, or "-" for standard input
 * @param terminal where standard input comes from
 * @returns the message, or null when neither was given
 */
export async function readMessageBody(
  words: readonly string[],
  file: string | undefined,
  terminal: CliTerminal
): Promise<string | null> {
  if (file === "-") {
    return terminal.readStdin();
  }
  if (file !== undefined) {
    return readFile(path.resolve(terminal.workingDirectory, file), "utf8");
  }
  return words.length === 0 ? null : words.join(" ");
}
