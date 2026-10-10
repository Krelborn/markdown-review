import { Button } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useContext, useEffect, useRef } from "react";

import { HoveredThreadContext } from "../../review/HoveredThreadContext";

import styles from "./DocumentView.module.css";
import type { ThreadMarker } from "./useThreadHighlights";

export interface ThreadMarkersProps {
  markers: ThreadMarker[];
  onSelectThread: (threadId: number) => void;
  selectedThreadId: number | null;
}

/**
 * A numbered button beside each thread's passage, which selects the thread and, while the pointer is over it, hovers it
 */
export function ThreadMarkers({ markers, onSelectThread, selectedThreadId }: ThreadMarkersProps): JSX.Element {
  const { hoveredThreadId, onHoverThread } = useContext(HoveredThreadContext);
  const pointedThreadIdRef = useRef<number | null>(null);
  useEffect(() => {
    // A marker removed from under the pointer gets no pointerleave, so its hover ends here
    const pointedThreadId = pointedThreadIdRef.current;
    if (pointedThreadId !== null && !markers.some(({ threadId }) => threadId === pointedThreadId)) {
      pointedThreadIdRef.current = null;
      onHoverThread(null);
    }
  }, [markers, onHoverThread]);
  return (
    <>
      {markers.map(({ column, threadId, top }) => (
        <Button
          className={clsx(styles.marker, { [styles.hoveredMarker ?? ""]: threadId === hoveredThreadId })}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          onPointerEnter={() => {
            pointedThreadIdRef.current = threadId;
            onHoverThread(threadId);
          }}
          onPointerLeave={() => {
            pointedThreadIdRef.current = null;
            onHoverThread(null);
          }}
          size="sm"
          style={{ insetInlineEnd: `${column * 2}rem`, top }}
          variant={threadId === selectedThreadId ? "primary" : "secondary"}
          aria-label={`Thread #${threadId}`}
          aria-pressed={threadId === selectedThreadId}
          data-md-ignore=""
        >
          {threadId}
        </Button>
      ))}
    </>
  );
}
