import { Alert, Prose, Stack } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useMemo, useRef } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import type { Thread } from "../../../shared/review/threadSchema";
import { isHighlighted } from "../../review/isHighlighted";
import type { NewComment } from "../../review/NewComment";

import { DocumentControls } from "./DocumentControls";
import styles from "./DocumentView.module.css";
import { useDocumentNavigation } from "./useDocumentNavigation";
import { useHoveredBlock } from "./useHoveredBlock";
import { useMermaidDiagrams } from "./useMermaidDiagrams";
import { useRenderedDocument } from "./useRenderedDocument";
import { useSelectionComment } from "./useSelectionComment";
import { useThreadHighlights } from "./useThreadHighlights";

export interface DocumentViewProps {
  /**
   * The doc as the server sent it
   */
  document: DocumentSource;

  /**
   * The page address's fragment, such as "#goals", naming a heading to scroll to once the doc is shown
   */
  hash: string;

  /**
   * Called when the user starts a comment on a passage or a block
   */
  onComment: (newComment: NewComment) => void;

  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;

  /**
   * Called when the user clicks a highlighted passage or its marker
   */
  onSelectThread: (threadId: number) => void;

  /**
   * Counts the user's requests to see the selected thread in its doc; each new one scrolls its passage into view
   */
  revealCount: number;

  selectedThreadId: number | null;

  /**
   * This doc's threads
   */
  threads: Thread[];
}

/**
 * The rendered doc, with its comments highlighted and marked, and the controls that start a new comment
 */
export function DocumentView({
  document: shown,
  hash,
  onComment,
  onNavigate,
  onSelectThread,
  revealCount,
  selectedThreadId,
  threads,
}: DocumentViewProps): JSX.Element {
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const { error, rendered } = useRenderedDocument(shown);
  const highlightedThreads = useMemo(
    () => threads.filter((thread) => isHighlighted(thread, selectedThreadId)),
    [selectedThreadId, threads]
  );
  const markers = useThreadHighlights(viewRef, contentRef, rendered, highlightedThreads, selectedThreadId);
  const selectionComment = useSelectionComment(viewRef, contentRef, rendered, shown.path);
  const hoveredBlock = useHoveredBlock(viewRef, contentRef);
  useDocumentNavigation(contentRef, rendered, {
    documentPath: shown.path,
    hash,
    highlightedThreads,
    onNavigate,
    onSelectThread,
    revealCount,
    selectedThreadId,
  });
  useMermaidDiagrams(contentRef, rendered);
  return (
    <Stack gap={3}>
      {error !== null && (
        <Alert role="alert" title="The doc could not be shown" tone="danger">
          {error}
        </Alert>
      )}
      <div className={styles.view} ref={viewRef}>
        <Prose
          as="article"
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: rendered?.html ?? "" }}
          ref={contentRef}
          aria-label={shown.path}
        />
        <DocumentControls
          document={shown}
          hoveredBlock={hoveredBlock}
          markers={markers}
          onComment={onComment}
          onSelectThread={onSelectThread}
          rendered={rendered}
          selectedThreadId={selectedThreadId}
          selectionComment={selectionComment}
        />
      </div>
    </Stack>
  );
}
