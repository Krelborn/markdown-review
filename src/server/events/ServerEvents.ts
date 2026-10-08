export type ServerEvent =
  | { type: "submitted" }
  | { type: "threads-changed" }
  | { type: "document-changed"; document: string }
  | { type: "presence"; agentWaiting: boolean };

type Listener = (event: ServerEvent) => void;

/**
 * Carries changes between the parts of the server: a submit wakes waiting polls, and the rest reach connected tabs
 */
export class ServerEvents {
  private readonly listeners = new Set<Listener>();

  public publish(event: ServerEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /**
   * @returns a function that stops the listener receiving events
   */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
