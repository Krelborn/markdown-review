export interface ReceivedEvent {
  data: unknown;
  event: string;
}

export interface EventReader {
  next(count: number): Promise<ReceivedEvent[]>;
  close(): Promise<void>;
}

/**
 * Reads server-sent events from a response, the way a browser's EventSource would
 *
 * @param response the response of `GET /api/events`
 * @returns a reader whose `next` resolves with the next `count` events
 */
export function readServerSentEvents(response: Response): EventReader {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new TypeError("The event stream has no body");
  }
  const decoder = new TextDecoder();
  let buffered = "";
  const next = async (count: number): Promise<ReceivedEvent[]> => {
    const received: ReceivedEvent[] = [];
    while (received.length < count) {
      const separator = buffered.indexOf("\n\n");
      if (separator === -1) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffered += decoder.decode(value, { stream: true });
        continue;
      }
      const block = buffered.slice(0, separator);
      buffered = buffered.slice(separator + 2);
      const fields = new Map(
        block.split("\n").map((line) => [line.slice(0, line.indexOf(": ")), line.slice(line.indexOf(": ") + 2)])
      );
      received.push({ data: JSON.parse(fields.get("data") ?? "null"), event: fields.get("event") ?? "" });
    }
    return received;
  };
  return { close: () => reader.cancel(), next };
}
