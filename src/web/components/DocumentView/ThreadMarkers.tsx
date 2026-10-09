import { Button } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useContext } from "react";

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
  return (
    <>
      {markers.map(({ column, threadId, top }) => (
        <Button
          className={clsx(styles.marker, { [styles.hoveredMarker ?? ""]: threadId === hoveredThreadId })}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          onPointerEnter={() => onHoverThread(threadId)}
          onPointerLeave={() => onHoverThread(null)}
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
