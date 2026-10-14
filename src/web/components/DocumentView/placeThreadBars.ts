import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

/**
 * A comment on two or more whole blocks
 */
export interface SpanThread extends BlockSpan {
  /**
   * How long the comment's passage is, in characters of the canonical text
   */
  length: number;

  threadId: number;
}

export interface PlacedThreadBar extends SpanThread {
  /**
   * The lane the comment's bar runs in: 1 nearest the prose, 2 outside it
   */
  lane: 1 | 2;
}

/**
 * Places the bars of comments on whole blocks in the two lanes beside the prose, so that bars of comments that share a
 * block run side by side
 *
 * @returns the comments, shortest first, each in lane 1 unless it shares a block with one placed there already, and then
 *   in lane 2, which any number may share
 */
export function placeThreadBars(threads: readonly SpanThread[]): PlacedThreadBar[] {
  const nearest: SpanThread[] = [];
  return [...threads]
    .sort((left, right) => left.length - right.length || left.threadId - right.threadId)
    .map((thread) => {
      if (nearest.some((placed) => sharesBlock(placed, thread))) {
        return { ...thread, lane: 2 };
      }
      nearest.push(thread);
      return { ...thread, lane: 1 };
    });
}

function sharesBlock(left: BlockSpan, right: BlockSpan): boolean {
  return left.firstBlock <= right.lastBlock && right.firstBlock <= left.lastBlock;
}
