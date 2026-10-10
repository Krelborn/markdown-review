import { Button } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useContext, useEffect } from "react";

import { HoveredThreadContext } from "../../review/HoveredThreadContext";
import { useThreadReporter } from "../../review/useThreadReporter";

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
  const { report, reported } = useThreadReporter(onHoverThread);
  useEffect(() => {
    // A marker removed from under the pointer gets no pointerleave, so its hover ends here
    if (!markers.some(({ threadId }) => threadId === reported())) {
      report(null);
    }
  }, [markers, report, reported]);
  return (
    <>
      {markers.map(({ column, threadId, top }) => (
        <Button
          className={clsx(styles.marker, { [styles.hoveredMarker ?? ""]: threadId === hoveredThreadId })}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          onPointerEnter={() => report(threadId)}
          onPointerLeave={() => report(null)}
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
