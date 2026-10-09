import { createContext } from "react";

import type { CommentEditor } from "./useCommentEditor";

export const CommentEditorContext = createContext<CommentEditor | null>(null);
