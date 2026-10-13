import type { ThreadsSnapshot } from "../shared/api/apiResponseSchemas";
import type { RoundOutcome } from "../shared/review/roundOutcome";
import { roundOutcome } from "../shared/review/roundOutcome";
import type { Thread } from "../shared/review/threadSchema";

import {
  addressThreadsStep,
  handedBackStep,
  handedBackWithCommentsStep,
  waitForCommentsStep,
  wentAheadStep,
  wentAheadWithCommentsStep,
} from "./nextSteps";

const longQuoteLength = 200;

const quoteStartLength = 120;

const quoteEndLength = 60;

/**
 * Describes the agent's inbox as compact text for the agent to read
 *
 * @param snapshot the review round and the threads that need the agent
 * @param notices lines to put just before `next_step`, each ending in a newline
 * @returns the summary, which says how the user ended the round if they have, each thread grouped by doc with its
 *   messages, any store problems, the notices, and a final `next_step`
 */
export function formatInbox({ problems, round, threads }: ThreadsSnapshot, notices: readonly string[] = []): string {
  const outcome = roundOutcome(round);
  const ordered = orderByDocument(threads);
  const ids = ordered.map((thread) => thread.id);
  const sections = [summaryLine(outcome, ordered)];
  if (ordered.length > 0) {
    sections.push(ordered.map(formatThread).join("\n\n"));
  }
  if (problems.length > 0) {
    sections.push(problems.map((problem) => `warning: ${indentContinuation(problem, "  ")}`).join("\n"));
  }
  if (notices.length > 0) {
    sections.push(notices.join("").trimEnd());
  }
  sections.push(`next_step: ${nextStep(outcome, ids)}`);
  return `${sections.join("\n\n")}\n`;
}

function formatThread(thread: Thread): string {
  const messages = thread.messages.map(({ author, body }) => `  ${author}: ${indentContinuation(body, "    ")}`);
  return [...describeAnchor(thread), ...messages].join("\n");
}

/**
 * Says where the thread is, and for a passage, the text it quotes now and what the user originally selected
 */
function describeAnchor({ anchor, id }: Thread): string[] {
  switch (anchor.kind) {
    case "review":
      return [`#${id} (whole review)`];
    case "document":
      return [`#${id} ${anchor.document} (whole doc)`];
    case "passage": {
      const range =
        anchor.startLine === anchor.endLine ? `${anchor.startLine}` : `${anchor.startLine}-${anchor.endLine}`;
      const location = `#${id} ${anchor.document}:${range}${anchor.outdated ? " (outdated)" : ""}`;
      if (anchor.outdated) {
        return [location, `  quote: ${formatQuote(anchor.quote)}`];
      }
      const original = anchor.anchoredText === anchor.quote ? [] : [`  was: ${formatQuote(anchor.quote)}`];
      return [location, `  quote: ${formatQuote(anchor.anchoredText)}`, ...original];
    }
  }
}

function summaryLine(outcome: RoundOutcome | null, threads: readonly Thread[]): string {
  if (threads.length === 0) {
    return noThreadsSummary(outcome);
  }
  const breakdown = countByGroup(threads);
  const needs = threads.length === 1 ? "1 thread needs you" : `${threads.length} threads need you`;
  switch (outcome) {
    case "go-ahead":
      return `The user said go ahead, ${needs} (${breakdown})`;
    case "hand-back":
      return `The user asked to hand back to you, with comments on ${countThreads(threads.length)} (${breakdown})`;
    case null:
      return `${needs} (${breakdown})`;
  }
}

function countByGroup(threads: readonly Thread[]): string {
  const counts = new Map<string, number>();
  for (const thread of threads) {
    const group = thread.anchor.kind === "review" ? "review" : thread.anchor.document;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  return [...counts].map(([group, count]) => `${group}: ${count}`).join(", ");
}

function countThreads(count: number): string {
  return count === 1 ? "1 thread" : `${count} threads`;
}

function noThreadsSummary(outcome: RoundOutcome | null): string {
  switch (outcome) {
    case "go-ahead":
      return "The user said go ahead. No threads need you.";
    case "hand-back":
      return "The user asked to hand back to you. No threads need you.";
    case null:
      return "No threads need you.";
  }
}

function nextStep(outcome: RoundOutcome | null, ids: readonly number[]): string {
  switch (outcome) {
    case "go-ahead":
      return ids.length === 0 ? wentAheadStep : wentAheadWithCommentsStep(ids);
    case "hand-back":
      return ids.length === 0 ? handedBackStep : handedBackWithCommentsStep(ids);
    case null:
      return ids.length === 0 ? waitForCommentsStep : addressThreadsStep(ids);
  }
}

function orderByDocument(threads: readonly Thread[]): Thread[] {
  const groupOf = (thread: Thread): string => (thread.anchor.kind === "review" ? "￿" : thread.anchor.document);
  return [...threads].sort((left, right) => groupOf(left).localeCompare(groupOf(right)) || left.id - right.id);
}

function formatQuote(text: string): string {
  const shortened =
    text.length > longQuoteLength ? `${text.slice(0, quoteStartLength)}…${text.slice(-quoteEndLength)}` : text;
  return JSON.stringify(shortened);
}

function indentContinuation(text: string, indent: string): string {
  return text.split("\n").join(`\n${indent}`);
}
