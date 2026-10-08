import type { NewThread } from "../../shared/review/newThreadSchema";

/**
 * A comment the user has started in the doc and not yet written
 */
export type NewComment = Omit<NewThread, "body">;
