import type { PollResponse } from "../../shared/api/apiResponseSchemas";
import type { ServerEvents } from "../events/ServerEvents";
import type { ReviewStore } from "../store/ReviewStore";

export interface WaitForInboxOptions {
  document: string | null;
  events: ServerEvents;
  signal: AbortSignal;
  store: ReviewStore;
  timeoutMilliseconds: number;
}

type WaitOutcome = "submitted" | "timed-out" | "aborted";

/**
 * Waits until the review is approved or a thread needs the agent
 *
 * @returns the inbox as soon as it has something for the agent, or as it stands when the time runs out or the
 *   request is aborted, with `timedOut` set
 */
export async function waitForInbox({
  document,
  events,
  signal,
  store,
  timeoutMilliseconds,
}: WaitForInboxOptions): Promise<PollResponse> {
  const deadline = Date.now() + timeoutMilliseconds;
  for (;;) {
    const nextSubmit = waitForSubmit(events, deadline - Date.now(), signal);
    const inbox = await store.readInbox(document);
    if (inbox.review.approved || inbox.threads.length > 0) {
      nextSubmit.cancel();
      return { ...inbox, timedOut: false };
    }
    if ((await nextSubmit.outcome) !== "submitted") {
      return { ...inbox, timedOut: true };
    }
  }
}

/**
 * Starts listening for the next submit straight away, so one that happens while the inbox is being read is not missed
 */
function waitForSubmit(
  events: ServerEvents,
  timeoutMilliseconds: number,
  signal: AbortSignal
): { outcome: Promise<WaitOutcome>; cancel: () => void } {
  let finish: (outcome: WaitOutcome) => void = () => {};
  const outcome = new Promise<WaitOutcome>((resolve) => {
    finish = resolve;
  });
  const timer = setTimeout(() => finish("timed-out"), Math.max(0, timeoutMilliseconds));
  const onAbort = (): void => finish("aborted");
  signal.addEventListener("abort", onAbort);
  const unsubscribe = events.subscribe((event) => {
    if (event.type === "submitted") {
      finish("submitted");
    }
  });
  const cancel = (): void => {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
    unsubscribe();
  };
  if (signal.aborted) {
    finish("aborted");
  }
  void outcome.then(cancel);
  return { cancel, outcome };
}
