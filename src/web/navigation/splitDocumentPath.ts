export interface DocumentPathParts {
  /**
   * The doc's file name, such as `plan.md`
   */
  fileName: string;

  /**
   * The folders the doc is in, such as `docs/notes`, or an empty string for a doc at the repo's root
   */
  folder: string;
}

/**
 * @param documentPath a doc's repo-relative path
 * @returns the doc's file name and the folder it is in
 */
export function splitDocumentPath(documentPath: string): DocumentPathParts {
  const lastSlash = documentPath.lastIndexOf("/");
  return {
    fileName: documentPath.slice(lastSlash + 1),
    folder: lastSlash === -1 ? "" : documentPath.slice(0, lastSlash),
  };
}
