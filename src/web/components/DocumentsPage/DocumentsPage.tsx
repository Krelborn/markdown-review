import { Alert } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useEffect, useState } from "react";

import type { DocumentList } from "../../../shared/api/apiResponseSchemas";
import type { Thread } from "../../../shared/review/threadSchema";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { DocumentLinks } from "../DocumentLinks/DocumentLinks";

export interface DocumentsPageProps {
  onNavigate: (pagePath: string) => void;

  /**
   * Every thread in the repo; the page reads the list again when they change
   */
  threads: Thread[];
}

/**
 * The page the app shows at its root: the docs with comments and the docs opened recently
 */
export function DocumentsPage({ onNavigate, threads }: DocumentsPageProps): JSX.Element {
  const api = useReviewApi();
  const [list, setList] = useState<DocumentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let isCurrent = true;
    api.readDocuments().then(
      (next) => {
        if (isCurrent) {
          setList(next);
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setError(describeFailure(failure));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [api, threads]);
  return (
    <>
      {error !== null && (
        <Alert role="alert" tone="danger">
          {error}
        </Alert>
      )}
      {list !== null && <DocumentLinks list={list} onNavigate={onNavigate} />}
    </>
  );
}
