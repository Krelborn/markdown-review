import { Alert, Text } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import type { NewComment } from "../../review/NewComment";
import type { DocumentState } from "../../review/useDocumentSource";
import { DocumentView } from "../DocumentView/DocumentView";

export interface DocumentPaneProps {
  documentPath: string;
  hash: string;
  onComment: (newComment: NewComment) => void;
  onNavigate: (pagePath: string) => void;
  onSelectThread: (threadId: number) => void;

  /**
   * Counts the user's requests to see the selected thread in its doc; each new one scrolls its passage into view
   */
  revealCount: number;

  selectedThreadId: number | null;

  /**
   * The server's last answer for the doc, or null while it is being read
   */
  state: DocumentState | null;

  /**
   * This doc's threads
   */
  threads: Thread[];
}

/**
 * The doc on screen, or why it cannot be shown
 */
export function DocumentPane({ documentPath, state, ...viewProps }: DocumentPaneProps): JSX.Element {
  switch (state?.kind) {
    case undefined:
      return (
        <Text as="p" tone="muted">
          Loading {documentPath}…
        </Text>
      );
    case "missing":
      return (
        <Alert role="alert" title={`${documentPath} was not found`} tone="warning">
          It may have been renamed or deleted. Its comments are in the sidebar, under Outdated.
        </Alert>
      );
    case "failed":
      return (
        <Alert role="alert" title={`${documentPath} could not be shown`} tone="danger">
          {state.message}
        </Alert>
      );
    case "loaded":
      return <DocumentView document={state.document} {...viewProps} />;
  }
}
