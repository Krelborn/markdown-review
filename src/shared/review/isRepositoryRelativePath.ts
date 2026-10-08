/**
 * Tells whether a path names a file inside the repo without leaving it
 *
 * @param value the path to check
 * @returns true for a relative POSIX path with no empty, "." or ".." segments
 */
export function isRepositoryRelativePath(value: string): boolean {
  if (value === "" || value.startsWith("/") || value.includes("\\")) {
    return false;
  }
  return value.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");
}
