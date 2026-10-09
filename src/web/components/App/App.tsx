import { IconButton, PageLayout, Theme } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useMemo, useRef } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import type { Thread } from "../../../shared/review/threadSchema";
import { useReviewApi } from "../../api/useReviewApi";
import { useReviewEvents } from "../../api/useReviewEvents";
import { documentPathOf } from "../../navigation/documentPathOf";
import { usePageLocation } from "../../navigation/usePageLocation";
import { countDrafts } from "../../review/countDrafts";
import type { NewComment } from "../../review/NewComment";
import { useCommentEditor } from "../../review/useCommentEditor";
import { useDocumentSource } from "../../review/useDocumentSource";
import { useThreads } from "../../review/useThreads";
import { useThreadSelection } from "../../review/useThreadSelection";
import { CloseIcon } from "../CloseIcon/CloseIcon";
import { DocumentsPage } from "../DocumentsPage/DocumentsPage";
import { PageAlerts } from "../PageAlerts/PageAlerts";
import { ReviewBar } from "../ReviewBar/ReviewBar";
import { ThreadSidebar } from "../ThreadSidebar/ThreadSidebar";
import { TopBar } from "../TopBar/TopBar";

import styles from "./App.module.css";
import { DocumentPane } from "./DocumentPane";
import { useCommentsPanel } from "./useCommentsPanel";

const unrequestedReview: ReviewState = { approved: false, approvedAt: null, requestedAt: null };

const commentsPanelId = "comments-panel";

/**
 * The review page: the bar across the top and any alerts, then the docs list or a doc beside the comments and the
 * review bar, each column scrolling on its own
 */
export function App(): JSX.Element {
  const api = useReviewApi();
  const documentColumnRef = useRef<HTMLElement>(null);
  const { location, navigate } = usePageLocation(documentColumnRef);
  const documentPath = documentPathOf(location.pathname);
  const threads = useThreads(api);
  const documentSource = useDocumentSource(api, documentPath);
  const selection = useThreadSelection(documentPath, navigate);
  const { closeButtonRef, closePanel, isPanelOpen, openPanel, panelRef, panelToggleRef, togglePanel } =
    useCommentsPanel();
  const connection = useReviewEvents(api, {
    onDocumentChanged: (document) => {
      if (document === documentPath) {
        documentSource.refresh();
      }
    },
    onNavigate: (url) => {
      const page = new URL(url);
      navigate(page.pathname + page.hash);
    },
    onReconnected: () => {
      threads.refresh();
      documentSource.refresh();
    },
    onThreadsChanged: threads.refresh,
  });
  const allThreads = useMemo(() => threads.snapshot?.threads ?? [], [threads.snapshot]);
  const documentThreads = useMemo(
    () => allThreads.filter(({ anchor }) => anchor.kind !== "review" && anchor.document === documentPath),
    [allThreads, documentPath]
  );
  const editor = useCommentEditor({ onChanged: threads.refresh, threads: allThreads });
  const startComment = (comment: NewComment): void => {
    editor.request({ comment, kind: "new" });
    openPanel();
  };
  const selectThreadInDocument = (threadId: number): void => {
    selection.selectThread(threadId);
    openPanel();
  };
  const showThreadInDocument = (thread: Thread): void => {
    selection.revealThread(thread);
    closePanel();
  };
  return (
    <Theme mode="system">
      <PageLayout className={styles.page}>
        <TopBar documentPath={documentPath} onNavigate={navigate} />
        <PageAlerts isConnected={connection.isConnected} threads={threads} />
        <div className={styles.columns}>
          <main className={styles.documentColumn} ref={documentColumnRef}>
            {documentPath === null ? (
              <DocumentsPage onNavigate={navigate} threads={allThreads} />
            ) : (
              <DocumentPane
                documentPath={documentPath}
                hash={location.hash}
                onComment={startComment}
                onNavigate={navigate}
                onSelectThread={selectThreadInDocument}
                revealCount={selection.revealCount}
                selectedThreadId={selection.selectedThreadId}
                state={documentSource.state}
                threads={documentThreads}
              />
            )}
          </main>
          <div
            className={clsx(styles.commentsPanel, { [styles.open ?? ""]: isPanelOpen })}
            id={commentsPanelId}
            ref={panelRef}
          >
            <ThreadSidebar
              closeButton={
                <IconButton label="Hide comments" onClick={closePanel} ref={closeButtonRef} size="sm" variant="ghost">
                  <CloseIcon />
                </IconButton>
              }
              documentPath={documentPath}
              editor={editor}
              onChanged={threads.refresh}
              onSelectThread={showThreadInDocument}
              selectedThreadId={selection.selectedThreadId}
              threads={allThreads}
            />
          </div>
          <div className={styles.reviewBar}>
            <ReviewBar
              agentWaiting={connection.agentWaiting}
              draftCount={countDrafts(allThreads)}
              isPanelOpen={isPanelOpen}
              onSubmitted={threads.refresh}
              onTogglePanel={togglePanel}
              panelId={commentsPanelId}
              panelToggleRef={panelToggleRef}
              review={threads.snapshot?.review ?? unrequestedReview}
            />
          </div>
        </div>
      </PageLayout>
    </Theme>
  );
}
