import type { BlockSpan } from "./BlockSpan";

/**
 * A part of a doc made of two or more whole blocks, which a comment can take in at once: a table, a list, a quote, a
 * GitHub alert, or a heading and the blocks under it up to the next heading of the same or a higher rank
 */
export type DocumentStructure = BlockSpan & {
  /**
   * How deep the structure sits in quotes, alerts and lists: 0 outside all of them
   */
  depth: number;
} & ({ kind: "list" | "quote" | "section" | "table" } | { alertKind: string; kind: "alert" });
