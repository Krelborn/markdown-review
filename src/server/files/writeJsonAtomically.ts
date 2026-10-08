import { randomUUID } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Writes a value as formatted JSON so readers see either the old file or the new one, never half of it
 *
 * @param filePath the file to write; missing parent directories are created
 * @param value the value to serialise
 * @param mode the file's permissions, e.g. 0o600 to keep other users out; the platform default when omitted
 */
export async function writeJsonAtomically(filePath: string, value: unknown, mode?: number): Promise<void> {
  const contents = `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", mode });
  await rename(temporaryPath, filePath);
}
