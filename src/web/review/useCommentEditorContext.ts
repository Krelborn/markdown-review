import { useContext } from "react";

import { CommentEditorContext } from "./CommentEditorContext";
import type { CommentEditor } from "./useCommentEditor";

/**
 * Gives a component the page's comment editor
 *
 * @returns the editor
 * @throws when no CommentEditorContext surrounds the component
 */
export function useCommentEditorContext(): CommentEditor {
  const editor = useContext(CommentEditorContext);
  if (editor === null) {
    throw new Error("useCommentEditorContext needs a CommentEditorContext around the component");
  }
  return editor;
}
