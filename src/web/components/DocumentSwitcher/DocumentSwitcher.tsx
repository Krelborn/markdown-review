import { Alert, ChevronDownIcon, Heading, Popover, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { DocumentList } from "../../../shared/api/apiResponseSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { splitDocumentPath } from "../../navigation/splitDocumentPath";
import { DocumentLinks } from "../DocumentLinks/DocumentLinks";

import styles from "./DocumentSwitcher.module.css";

export interface DocumentSwitcherProps {
  /**
   * Class names for the heading
   */
  className?: string;

  /**
   * The doc on screen
   */
  documentPath: string;

  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;
}

/**
 * The page's heading: the doc's file name, which opens a menu of the docs with comments and the docs opened recently,
 * so the user can move between them
 */
export function DocumentSwitcher({ className, documentPath, onNavigate }: DocumentSwitcherProps): JSX.Element {
  const api = useReviewApi();
  const [list, setList] = useState<DocumentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popover = usePopover({
    onOpenChange: (open) => {
      if (open) {
        api.readDocuments().then(setList, (failure: unknown) => setError(describeFailure(failure)));
      }
    },
  });
  return (
    <>
      <Heading className={className} level={1} size="md">
        <button {...popover.getTriggerProps()} className={styles.button} title={documentPath} type="button">
          <span className={styles.fileName}>{splitDocumentPath(documentPath).fileName}</span>
          <ChevronDownIcon className={styles.caret} />
        </button>
      </Heading>
      <Popover {...popover.getOverlayProps()}>
        {error !== null && <Alert tone="danger">{error}</Alert>}
        {list !== null && (
          <DocumentLinks
            currentDocument={documentPath}
            list={list}
            onNavigate={(pagePath) => {
              popover.close();
              onNavigate(pagePath);
            }}
          />
        )}
      </Popover>
    </>
  );
}
