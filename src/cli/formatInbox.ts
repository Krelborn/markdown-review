import type { ThreadsSnapshot } from "../shared/api/apiResponseSchemas";
import type { Thread } from "../shared/review/threadSchema";

import { addressThreadsStep, approvedStep, approvedWithCommentsStep, waitForCommentsStep } from "./nextSteps";

const longQuoteLength = 200;

const quoteStartLength = 120;

const quoteEndLength = 60;

/**
 * Describes the agent's inbox as compact text for the agent to read
 *
 * @param snapshot the review state and the threads that need the agent
 * @returns the summary, each thread grouped by doc with its messages, any store problems, and a final `next_step`
 */
export function formatInbox({ problems, review, threads }: ThreadsSnapshot): string {
  const ordered = orderByDocument(threads);
  const ids = ordered.map((thread) => thread.id);
  const sections = [summaryLine(review.approved, ordered)];
  if (ordered.length > 0) {
    sections.push(ordered.map(formatThread).join("\n\n"));
  }
  if (problems.length > 0) {
    sections.push(problems.map((problem) => `warning: ${indentContinuation(problem, "  ")}`).join("\n"));
  }
  sections.push(`next_step: ${nextStep(review.approved, ids)}`);
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

function summaryLine(approved: boolean, threads: readonly Thread[]): string {
  if (threads.length === 0) {
    return approved ? "Review approved. No threads need you." : "No threads need you.";
  }
  const counts = new Map<string, number>();
  for (const thread of threads) {
    const group = thread.anchor.kind === "review" ? "review" : thread.anchor.document;
    counts.set(group, (counts.get(group) ?? 0) + 1);
  }
  const breakdown = [...counts].map(([group, count]) => `${group}: ${count}`).join(", ");
  const needs = threads.length === 1 ? "1 thread needs you" : `${threads.length} threads need you`;
  return approved ? `Review approved, ${needs} (${breakdown})` : `${needs} (${breakdown})`;
}

function nextStep(approved: boolean, ids: readonly number[]): string {
  if (ids.length === 0) {
    return approved ? approvedStep : waitForCommentsStep;
  }
  return approved ? approvedWithCommentsStep(ids) : addressThreadsStep(ids);
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
