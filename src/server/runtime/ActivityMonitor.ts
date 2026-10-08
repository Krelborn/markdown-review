import type { ServerEvents } from "../events/ServerEvents";

export interface ActivityMonitorOptions {
  events: ServerEvents;

  /**
   * How long the server may sit with no connected tab, no waiting poll and no request before `onIdle` is called
   */
  idleMilliseconds: number;

  onIdle: () => void;
}

/**
 * Tracks connected tabs and waiting polls, reports whether the agent is waiting, and notices when the server is idle
 */
export class ActivityMonitor {
  private browsers = 0;
  private readonly events: ServerEvents;
  private readonly idleMilliseconds: number;
  private idleTimer: NodeJS.Timeout | undefined;
  private readonly onIdle: () => void;
  private polls = 0;

  public constructor({ events, idleMilliseconds, onIdle }: ActivityMonitorOptions) {
    this.events = events;
    this.idleMilliseconds = idleMilliseconds;
    this.onIdle = onIdle;
    this.restartIdleTimer();
  }

  public get agentWaiting(): boolean {
    return this.polls > 0;
  }

  /**
   * Records a request, which restarts the idle countdown
   */
  public touch(): void {
    this.restartIdleTimer();
  }

  /**
   * @returns a function to call when the tab disconnects
   */
  public beginBrowser(): () => void {
    this.browsers += 1;
    this.restartIdleTimer();
    return this.once(() => {
      this.browsers -= 1;
      this.restartIdleTimer();
    });
  }

  /**
   * @returns a function to call when the poll ends
   */
  public beginPoll(): () => void {
    this.polls += 1;
    this.restartIdleTimer();
    if (this.polls === 1) {
      this.events.publish({ agentWaiting: true, type: "presence" });
    }
    return this.once(() => {
      this.polls -= 1;
      this.restartIdleTimer();
      if (this.polls === 0) {
        this.events.publish({ agentWaiting: false, type: "presence" });
      }
    });
  }

  public stop(): void {
    clearTimeout(this.idleTimer);
  }

  private restartIdleTimer(): void {
    clearTimeout(this.idleTimer);
    this.idleTimer =
      this.browsers === 0 && this.polls === 0 ? setTimeout(this.onIdle, this.idleMilliseconds).unref() : undefined;
  }

  private once(end: () => void): () => void {
    let ended = false;
    return () => {
      if (!ended) {
        ended = true;
        end();
      }
    };
  }
}
