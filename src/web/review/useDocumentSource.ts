import { useCallback, useEffect, useState } from "react";

import type { DocumentSource } from "../../shared/api/apiResponseSchemas";
import { describeFailure } from "../api/describeFailure";
import type { ReviewApi } from "../api/ReviewApi";
import { ReviewApiError } from "../api/ReviewApiError";

export type DocumentState =
  | { kind: "loaded"; document: DocumentSource }
  | { kind: "missing"; path: string }
  | { kind: "failed"; message: string; path: string };

export interface DocumentSourceState {
  /**
   * Reads the doc again, keeping the current state until the new one arrives
   */
  refresh: () => void;

  /**
   * The last answer for the doc, or null until it arrives
   */
  state: DocumentState | null;
}

/**
 * Reads a doc's source from the server, again whenever the doc or a refresh asks for it
 *
 * @param documentPath the doc to read, or null to read none
 */
export function useDocumentSource(api: ReviewApi, documentPath: string | null): DocumentSourceState {
  const [state, setState] = useState<DocumentState | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (documentPath === null) {
      return;
    }
    let isCurrent = true;
    api.readDocument(documentPath).then(
      (document) => {
        if (isCurrent) {
          setState({ document, kind: "loaded" });
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setState(toFailedState(documentPath, failure));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [api, documentPath, revision]);
  const refresh = useCallback(() => setRevision((current) => current + 1), []);
  const isForDocument = state !== null && (state.kind === "loaded" ? state.document.path : state.path) === documentPath;
  return { refresh, state: isForDocument ? state : null };
}

function toFailedState(path: string, failure: unknown): DocumentState {
  return failure instanceof ReviewApiError && failure.reason === "missing-document"
    ? { kind: "missing", path }
    : { kind: "failed", message: describeFailure(failure), path };
}
