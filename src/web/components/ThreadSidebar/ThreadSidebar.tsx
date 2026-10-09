import { Counter, Tab, TabList, TabPanel, Tabs, Text } from "@krelborn/stylesui";
import type { JSX, ReactNode } from "react";
import { useState } from "react";

import type { Thread } from "../../../shared/review/threadSchema";
import { CommentEditorContext } from "../../review/CommentEditorContext";
import type { ThreadView } from "../../review/threadsInView";
import { threadsInView } from "../../review/threadsInView";
import type { CommentEditor } from "../../review/useCommentEditor";
import { CommentsHeader } from "../CommentsHeader/CommentsHeader";

import { CommentsList } from "./CommentsList";
import styles from "./ThreadSidebar.module.css";

export interface ThreadSidebarProps {
  /**
   * The button that hides the comments in a narrow window, shown at the end of their header
   */
  closeButton: ReactNode;

  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * The page's comment editor, which the sidebar shows as the composer or inside the card of the thread it writes to
   */
  editor: CommentEditor;

  /**
   * Called after the sidebar changes threads on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see a thread in its doc
   */
  onSelectThread: (thread: Thread) => void;

  selectedThreadId: number | null;

  /**
   * Every thread in the repo
   */
  threads: Thread[];
}

/**
 * The comments beside the doc: a header that starts comments on the doc or the review and, when other docs have
 * threads, chooses between this doc's threads and every doc's; then the composer and the threads
 */
export function ThreadSidebar({
  closeButton,
  documentPath,
  editor,
  onChanged,
  onSelectThread,
  selectedThreadId,
  threads,
}: ThreadSidebarProps): JSX.Element {
  const [chosenView, setChosenView] = useState<ThreadView>("document");
  const inView = threadsInView(threads, documentPath, chosenView, editor.editingThreadId);
  if (!inView.hasChoice && chosenView !== "document") {
    setChosenView("document");
  }
  const header = (
    <CommentsHeader
      closeButton={closeButton}
      documentPath={documentPath}
      onComment={(comment) => editor.request({ comment, kind: "new" })}
      tabs={
        inView.hasChoice ? (
          <TabList aria-label="Show comments on">
            <Tab className={styles.tab} value="document">
              This doc <Counter count={inView.counts.document} />
            </Tab>
            <Tab className={styles.tab} value="all">
              All docs <Counter count={inView.counts.all} />
            </Tab>
          </TabList>
        ) : undefined
      }
      title={
        <Text weight="bold">
          {inView.hasChoice ? (
            "Comments"
          ) : (
            <>
              Comments <Counter count={inView.threads.length} />
            </>
          )}
        </Text>
      }
    />
  );
  const list = (
    <CommentsList
      documentPath={documentPath}
      onChanged={onChanged}
      onSelectThread={onSelectThread}
      selectedThreadId={selectedThreadId}
      showsDocuments={inView.showsDocuments}
      threads={inView.threads}
    />
  );
  return (
    <CommentEditorContext value={editor}>
      <aside aria-label="Comments">
        {inView.hasChoice ? (
          <Tabs
            className={styles.tabs}
            onValueChange={(value) => setChosenView(value === "all" ? "all" : "document")}
            size="sm"
            value={inView.view}
          >
            {header}
            {/* One panel, always the selected one, so the list stays mounted when the user switches tabs */}
            <TabPanel value={inView.view}>{list}</TabPanel>
          </Tabs>
        ) : (
          <>
            {header}
            {list}
          </>
        )}
      </aside>
    </CommentEditorContext>
  );
}
