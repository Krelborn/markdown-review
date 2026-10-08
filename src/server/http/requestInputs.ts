import type { Context } from "hono";
import type { ZodType } from "zod";

import { resolveRepositoryPath } from "../files/resolveRepositoryPath";
import { parseStoreInput } from "../store/parseStoreInput";

import { HttpError } from "./HttpError";

/**
 * Reads and validates a JSON request body
 *
 * @throws StoreError "invalid-input" when the body is not JSON or does not have the schema's shape
 */
export async function readJsonBody<Value>(context: Context, schema: ZodType<Value>): Promise<Value> {
  let body: unknown;
  try {
    body = await context.req.json();
  } catch {
    body = undefined;
  }
  return parseStoreInput(schema, body, "The request body");
}

/**
 * Reads the `:id` route parameter
 *
 * @throws HttpError 400 when it is not a positive whole number
 */
export function readThreadId(context: Context): number {
  const id = context.req.param("id") ?? "";
  if (!/^[1-9][0-9]*$/.test(id)) {
    throw new HttpError(400, "invalid-input", `"${id}" is not a thread ID`);
  }
  return Number(id);
}

/**
 * Checks that a doc path from a request stays inside the repo
 *
 * @param root the repo root
 * @param document a repo-relative POSIX path
 * @param allowMissing whether a doc that no longer exists is acceptable, as it is when reading its threads
 * @throws HttpError 400 for a path that is not repo-relative, 403 for one that leads out of the repo or into the
 *   review store, and 404 for a missing doc unless `allowMissing` is set
 */
export async function checkDocumentPath(root: string, document: string, allowMissing: boolean): Promise<void> {
  const resolved = await resolveRepositoryPath(root, document);
  switch (resolved.kind) {
    case "invalid":
      throw new HttpError(400, "invalid-input", `${document} is not a repo-relative path`);
    case "outside":
      throw new HttpError(403, "outside-root", `${document} leads outside the repo`);
    case "private":
      throw new HttpError(403, "private-file", `${document} is in the review store`);
    case "missing":
      if (!allowMissing) {
        throw new HttpError(404, "missing-document", `${document} does not exist`);
      }
      return;
    case "inside":
      return;
  }
}
