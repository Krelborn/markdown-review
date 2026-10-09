import { Alert, PageLayout, Sidebar, Stack, Theme } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useMemo, useState } from "react";

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

const unrequestedReview: ReviewState = { approved: false, approvedAt: null, requestedAt: null };

/**
 * The review page: the docs list or a doc, the comments beside it, and the bar across the top
 */
export function App(): JSX.Element {
  const api = useReviewApi();
  const { location, navigate } = usePageLocation();
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
  const problems = [...(threads.error === null ? [] : [threads.error]), ...(threads.snapshot?.problems ?? [])];
  return (
    <Theme mode="system">
      <PageLayout>
        <TopBar
          agentWaiting={connection.agentWaiting}
          documentPath={documentPath}
          draftCount={countDrafts(allThreads)}
          onNavigate={navigate}
          onSubmitted={threads.refresh}
          review={threads.snapshot?.review ?? unrequestedReview}
        />
        <Sidebar align="start" as="main" className={styles.main} sideWidth="24rem">
          <Stack gap={3}>
            {!connection.isConnected && (
              <Alert role="alert" title="Lost the connection to the review server" tone="warning">
                Trying again. If the server has stopped, ask the agent to run <code>markdown-review open</code>, which
                starts it again.
              </Alert>
            )}
            {problems.length > 0 && (
              <Alert title="Some comments could not be read" tone="danger">
                {problems.join(" ")}
              </Alert>
            )}
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
          </Stack>
          <div className={styles.sidebar}>
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
        </Sidebar>
      </PageLayout>
    </Theme>
  );
}
