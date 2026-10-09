import { PageLayout, Theme } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useMemo, useRef, useState } from "react";

import type { ReviewState } from "../../../shared/review/ReviewState";
import { useReviewApi } from "../../api/useReviewApi";
import { useReviewEvents } from "../../api/useReviewEvents";
import { documentPathOf } from "../../navigation/documentPathOf";
import { usePageLocation } from "../../navigation/usePageLocation";
import { countDrafts } from "../../review/countDrafts";
import type { NewComment } from "../../review/NewComment";
import { useDocumentSource } from "../../review/useDocumentSource";
import { useThreads } from "../../review/useThreads";
import { useThreadSelection } from "../../review/useThreadSelection";
import { DocumentsPage } from "../DocumentsPage/DocumentsPage";
import { ThreadSidebar } from "../ThreadSidebar/ThreadSidebar";
import { TopBar } from "../TopBar/TopBar";

import styles from "./App.module.css";
import { DocumentPane } from "./DocumentPane";
import { PageAlerts } from "./PageAlerts";

const unrequestedReview: ReviewState = { approved: false, approvedAt: null, requestedAt: null };

/**
 * The review page: the bar across the top and any alerts, then the docs list or a doc beside the comments, each
 * scrolling on its own
 */
export function App(): JSX.Element {
  const api = useReviewApi();
  const documentColumnRef = useRef<HTMLElement>(null);
  const { location, navigate } = usePageLocation(documentColumnRef);
  const documentPath = documentPathOf(location.pathname);
  const threads = useThreads(api);
  const documentSource = useDocumentSource(api, documentPath);
  const selection = useThreadSelection(documentPath, navigate);
  const [newComment, setNewComment] = useState<NewComment | null>(null);
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
  return (
    <Theme mode="system">
      <PageLayout className={styles.page}>
        <TopBar
          agentWaiting={connection.agentWaiting}
          documentPath={documentPath}
          draftCount={countDrafts(allThreads)}
          onNavigate={navigate}
          onSubmitted={threads.refresh}
          review={threads.snapshot?.review ?? unrequestedReview}
        />
        <PageAlerts isConnected={connection.isConnected} threads={threads} />
        <div className={styles.columns}>
          <main className={styles.documentColumn} ref={documentColumnRef}>
            {documentPath === null ? (
              <DocumentsPage onNavigate={navigate} threads={allThreads} />
            ) : (
              <DocumentPane
                documentPath={documentPath}
                hash={location.hash}
                onComment={setNewComment}
                onNavigate={navigate}
                onSelectThread={selection.selectThread}
                revealCount={selection.revealCount}
                selectedThreadId={selection.selectedThreadId}
                state={documentSource.state}
                threads={documentThreads}
              />
            )}
          </main>
          <div className={styles.commentsPanel}>
            <ThreadSidebar
              documentPath={documentPath}
              newComment={newComment}
              onChanged={threads.refresh}
              onCloseNewComment={() => setNewComment(null)}
              onSelectThread={selection.revealThread}
              selectedThreadId={selection.selectedThreadId}
              threads={allThreads}
            />
          </div>
        </div>
      </PageLayout>
    </Theme>
  );
}
