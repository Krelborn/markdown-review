/**
 * @param document a repo-relative POSIX path
 * @returns the path of the app's page for the doc, e.g. "/document/docs/Design%20Notes.md"
 */
export function documentPagePath(document: string): string {
  return `/document/${document.split("/").map(encodeURIComponent).join("/")}`;
}
