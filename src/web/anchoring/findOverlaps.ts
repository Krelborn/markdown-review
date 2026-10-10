/**
 * Finds the text that two of the given ranges both cover
 *
 * @param ranges ranges in the same document
 * @returns a range for each pair of ranges that share text, covering the text they share
 */
export function findOverlaps(ranges: readonly Range[]): Range[] {
  return ranges.flatMap((range, index) =>
    ranges.slice(index + 1).flatMap((other) => {
      const overlap = intersection(range, other);
      return overlap === null ? [] : [overlap];
    })
  );
}

function intersection(first: Range, second: Range): Range | null {
  const startsLater = first.compareBoundaryPoints(Range.START_TO_START, second) >= 0 ? first : second;
  const endsEarlier = first.compareBoundaryPoints(Range.END_TO_END, second) <= 0 ? first : second;
  const overlap = startsLater.cloneRange();
  overlap.setEnd(endsEarlier.endContainer, endsEarlier.endOffset);
  return overlap.collapsed ? null : overlap;
}
