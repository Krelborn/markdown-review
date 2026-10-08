import { CliError } from "./CliError";

/**
 * @param value the command's first word
 * @param usage the command's usage line, for the error
 * @returns the thread ID
 * @throws CliError when the word is not a thread ID
 */
export function readThreadIdArgument(value: string | undefined, usage: string): number {
  if (value === undefined || !/^#?[1-9][0-9]*$/.test(value)) {
    throw new CliError(`Expected a thread ID such as 14, not ${value ?? "nothing"}`, `Run \`${usage}\`.`, 2);
  }
  return Number(value.replace("#", ""));
}
