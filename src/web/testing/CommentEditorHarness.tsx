import type { JSX, ReactNode } from "react";

import type { Thread } from "../../shared/review/threadSchema";
import { CommentEditorContext } from "../review/CommentEditorContext";
import type { CommentEditor } from "../review/useCommentEditor";
import { useCommentEditor } from "../review/useCommentEditor";

export interface CommentEditorHarnessProps {
  /**
   * Renders the component under test, given the editor
   */
  children: (editor: CommentEditor) => ReactNode;

  onChanged: () => void;
  threads: readonly Thread[];
}

/**
 * Runs the page's comment editor for a test, as `App` does, and gives it to the component under test both directly and
 * through `CommentEditorContext`
 */
export function CommentEditorHarness({ children, onChanged, threads }: CommentEditorHarnessProps): JSX.Element {
  const editor = useCommentEditor({ onChanged, threads });
  return <CommentEditorContext value={editor}>{children(editor)}</CommentEditorContext>;
}
