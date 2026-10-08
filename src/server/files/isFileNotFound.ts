/**
 * Tells whether a file system error means the file does not exist
 *
 * @param error the error a file system call rejected with
 * @returns true for ENOENT
 */
export function isFileNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}
