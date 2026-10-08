import type { ZodType } from "zod";
import { z } from "zod";

import { readTextFileOrNull } from "../files/readTextFileOrNull";

import type { StoreFileResult } from "./StoreFileResult";

/**
 * Reads and validates a store file
 *
 * @param filePath the file to read
 * @param schema the shape the file must have
 * @returns the file's value, null when the file does not exist, or a description of what is wrong with it
 * @throws the file system error when the file exists but cannot be read
 */
export async function readStoreFile<Value>(
  filePath: string,
  schema: ZodType<Value>
): Promise<StoreFileResult<Value | null>> {
  const contents = await readTextFileOrNull(filePath);
  if (contents === null) {
    return { kind: "valid", value: null };
  }
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { kind: "invalid", problem: `${filePath} is not valid JSON: ${reason}` };
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    return { kind: "invalid", problem: `${filePath} is not a valid store file:\n${z.prettifyError(result.error)}` };
  }
  return { kind: "valid", value: result.data };
}
