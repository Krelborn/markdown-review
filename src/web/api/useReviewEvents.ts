import { useEffect, useEffectEvent, useRef, useState } from "react";

import type { ReviewApi } from "./ReviewApi";
import type { ReviewEvent } from "./reviewEventSchema";

export interface ReviewEventHandlers {
  onDocumentChanged: (document: string) => void;

  /**
   * Called with the absolute address of the page the agent asked the tab to show
   */
  onNavigate: (url: string) => void;

  /**
   * Called when the connection comes back after dropping, when anything may have changed
   */
  onReconnected: () => void;

  onThreadsChanged: () => void;
}

export interface ServerConnection {
  agentWaiting: boolean;
  isConnected: boolean;
}

/**
 * Listens to the server's events for as long as the page is open
 *
 * @returns whether the agent is waiting for a submit, and whether the server can be reached
 */
export function useReviewEvents(api: ReviewApi, handlers: ReviewEventHandlers): ServerConnection {
  const [connection, setConnection] = useState<ServerConnection>({ agentWaiting: false, isConnected: true });
  const hasDropped = useRef(false);
  const handle = useEffectEvent((event: ReviewEvent): void => {
    switch (event.type) {
      case "presence":
        setConnection((current) => ({ ...current, agentWaiting: event.agentWaiting }));
        return;
      case "threads-changed":
        handlers.onThreadsChanged();
        return;
      case "document-changed":
        handlers.onDocumentChanged(event.document);
        return;
      case "navigate":
        handlers.onNavigate(event.url);
        return;
      case "connected":
        setConnection((current) => ({ ...current, isConnected: true }));
        if (hasDropped.current) {
          hasDropped.current = false;
          handlers.onReconnected();
        }
        return;
      case "disconnected":
        hasDropped.current = true;
        setConnection((current) => ({ ...current, isConnected: false }));
    }
  });
  useEffect(() => api.subscribe(handle), [api]);
  return connection;
}
