import search from "approx-string-match";

import type { DocumentText } from "../../shared/markdown/DocumentText";
import { linesForRange } from "../../shared/markdown/linesForRange";
import type { PassageAnchor } from "../../shared/review/anchorSchema";
import { contextLength } from "../../shared/review/anchorSchema";

const maxErrorRatio = 0.2;

interface Candidate {
  start: number;
  end: number;
  errors: number;
}

/**
 * Moves a passage anchor to where its text is in the current version of its doc
 *
 * @param anchor the anchor as last computed
 * @param documentText the canonical text of the doc as it is now
 * @returns the anchor on the best exact or approximate match, or the anchor marked outdated, with its old position
 *   clamped to the doc, when nothing matches
 */
export function reanchorPassage(anchor: PassageAnchor, documentText: DocumentText): PassageAnchor {
  const candidates = exactCandidates(anchor.anchoredText, documentText.text);
  const best = chooseCandidate(
    candidates.length > 0 ? candidates : approximateCandidates(anchor.anchoredText, documentText.text),
    anchor,
    documentText.text
  );
  if (best === undefined) {
    return {
      ...anchor,
      endOffset: Math.min(anchor.endOffset, documentText.text.length),
      outdated: true,
      startOffset: Math.min(anchor.startOffset, documentText.text.length),
    };
  }
  const { end, start } = best;
  return {
    ...anchor,
    ...linesForRange(documentText, start, end),
    anchoredText: documentText.text.slice(start, end),
    endOffset: end,
    outdated: false,
    prefix: documentText.text.slice(Math.max(0, start - contextLength), start),
    startOffset: start,
    suffix: documentText.text.slice(end, end + contextLength),
  };
}

function exactCandidates(pattern: string, text: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (let start = text.indexOf(pattern); start !== -1; start = text.indexOf(pattern, start + 1)) {
    candidates.push({ end: start + pattern.length, errors: 0, start });
  }
  return candidates;
}

function approximateCandidates(pattern: string, text: string): Candidate[] {
  const maxErrors = Math.floor(maxErrorRatio * pattern.length);
  return maxErrors === 0 ? [] : search(text, pattern, maxErrors);
}

function chooseCandidate(candidates: readonly Candidate[], anchor: PassageAnchor, text: string): Candidate | undefined {
  const ranked = candidates.map((candidate) => ({
    candidate,
    contextScore: contextScore(candidate, anchor, text),
    distance: Math.abs(candidate.start - anchor.startOffset),
  }));
  ranked.sort(
    (left, right) =>
      left.candidate.errors - right.candidate.errors ||
      right.contextScore - left.contextScore ||
      left.distance - right.distance
  );
  return ranked[0]?.candidate;
}

function contextScore({ end, start }: Candidate, { prefix, suffix }: PassageAnchor, text: string): number {
  const textBefore = text.slice(Math.max(0, start - prefix.length), start);
  const textAfter = text.slice(end, end + suffix.length);
  return commonSuffixLength(prefix, textBefore) + commonPrefixLength(suffix, textAfter);
}

function commonPrefixLength(left: string, right: string): number {
  let length = 0;
  while (length < left.length && left[length] === right[length]) {
    length += 1;
  }
  return length;
}

function commonSuffixLength(left: string, right: string): number {
  let length = 0;
  while (length < left.length && left[left.length - 1 - length] === right[right.length - 1 - length]) {
    length += 1;
  }
  return length;
}
