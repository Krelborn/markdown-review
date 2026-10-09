import type { NewComment } from "./NewComment";

/**
 * What the comment editor writes: a comment the user has started, or a thread's draft, which is a new reply until it is
 * first saved
 */
export type EditorTarget = { comment: NewComment; kind: "new" } | { kind: "thread"; threadId: number };
