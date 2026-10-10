import { Alert, Prose, Stack } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useMemo, useRef, useState } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import type { NewPassageAnchor } from "../../../shared/review/newThreadSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { isHighlighted } from "../../review/isHighlighted";
import type { NewComment } from "../../review/NewComment";

import { DocumentControls } from "./DocumentControls";
import styles from "./DocumentView.module.css";
import { useDocumentNavigation } from "./useDocumentNavigation";
import { useDocumentOverlay } from "./useDocumentOverlay";
import { useMermaidDiagrams } from "./useMermaidDiagrams";
import { useRenderedDocument } from "./useRenderedDocument";

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
   * The passage of the comment the user is writing on this doc, or null
   */
  pendingPassage: NewPassageAnchor | null;

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
  pendingPassage,
  revealCount,
  selectedThreadId,
  threads,
}: DocumentViewProps): JSX.Element {
  const viewRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const { error, rendered } = useRenderedDocument(shown);
  const [isBlockButtonFocused, setIsBlockButtonFocused] = useState(false);
  const highlightedThreads = useMemo(
    () => threads.filter((thread) => isHighlighted(thread, selectedThreadId)),
    [selectedThreadId, threads]
  );
  const overlay = useDocumentOverlay(viewRef, contentRef, rendered, {
    documentPath: shown.path,
    highlightedThreads,
    isBlockButtonFocused,
    pendingPassage,
    selectedThreadId,
  });
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
      <RenderFailure error={error} />
      <div
        className={clsx(styles.view, { [styles.pointingAtHighlight ?? ""]: overlay.isPointingAtHighlight })}
        ref={viewRef}
      >
        <Prose
          as="article"
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: rendered?.html ?? "" }}
          ref={contentRef}
          aria-label={shown.path}
        />
        <DocumentControls
          blockIndexLevelWith={overlay.blockIndexLevelWith}
          document={shown}
          hoveredBlock={overlay.hoveredBlock}
          isBlockButtonFocused={isBlockButtonFocused}
          markers={overlay.markers}
          onBlockButtonFocusChange={setIsBlockButtonFocused}
          onComment={onComment}
          onSelectThread={onSelectThread}
          pendingBlock={overlay.pendingBlock}
          rendered={rendered}
          selectedThreadId={selectedThreadId}
          selectionComment={overlay.selectionComment}
        />
      </div>
    </Stack>
  );
}

function RenderFailure({ error }: { error: string | null }): JSX.Element | null {
  return error === null ? null : (
    <Alert role="alert" title="The doc could not be shown" tone="danger">
      {error}
    </Alert>
  );
}
