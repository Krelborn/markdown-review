import { isRepositoryRelativePath } from "../../shared/review/isRepositoryRelativePath";

/**
 * @param pathname the path of one of the app's pages
 * @returns the repo-relative path of the doc the page shows, or null for any other page
 */
export function documentPathOf(pathname: string): string | null {
  if (!pathname.startsWith("/document/")) {
    return null;
  }
  try {
    const document = pathname.slice("/document/".length).split("/").map(decodeURIComponent).join("/");
    return isRepositoryRelativePath(document) ? document : null;
  } catch {
    return null;
  }
}
