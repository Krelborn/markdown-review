import type { ZodType } from "zod";
import { z } from "zod";

import { StoreError } from "./StoreError";

/**
 * Checks a value before the store acts on it or writes it
 *
 * @param schema the shape the value must have
 * @param value the value
 * @param description what the value is, for the error message, e.g. "The reply"
 * @returns the validated value
 * @throws StoreError "invalid-input" when the value does not have that shape
 */
export function parseStoreInput<Value>(schema: ZodType<Value>, value: unknown, description: string): Value {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new StoreError("invalid-input", `${description} is not valid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
