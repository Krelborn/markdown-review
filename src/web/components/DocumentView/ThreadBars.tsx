import { clsx } from "clsx";
import type { JSX } from "react";
import { useContext, useEffect } from "react";

import { HoveredThreadContext } from "../../review/HoveredThreadContext";
import { useThreadReporter } from "../../review/useThreadReporter";

import { BlockTarget, verticalOutset } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import type { ThreadBar } from "./useThreadBars";

export interface ThreadBarsProps {
  bars: ThreadBar[];
  onSelectThread: (threadId: number) => void;
  selectedThreadId: number | null;
}

/**
 * A bar beside the blocks of each comment on two or more whole blocks, which selects the comment and, while the pointer
 * is over it, hovers it; the blocks of a hovered or selected comment are framed
 */
export function ThreadBars({ bars, onSelectThread, selectedThreadId }: ThreadBarsProps): JSX.Element {
  const { hoveredThreadId, onHoverThread } = useContext(HoveredThreadContext);
  const { report, reported } = useThreadReporter(onHoverThread);
  useEffect(() => {
    // A bar removed from under the pointer gets no pointerleave, so its hover ends here
    if (!bars.some(({ threadId }) => threadId === reported())) {
      report(null);
    }
  }, [bars, report, reported]);
  const framed = bars.filter(({ threadId }) => threadId === hoveredThreadId || threadId === selectedThreadId);
  return (
    <>
      {framed.map(({ box, threadId }) => (
        <BlockTarget box={box} key={threadId} tone={threadId === selectedThreadId ? "primary" : "warning"} />
      ))}
      {bars.map(({ box, lane, threadId }) => (
        // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the thread's marker is the control for keyboards and screen readers; the bar only shows where the comment is to the pointer
        <div
          className={clsx(styles.threadBar, {
            [styles.outerThreadBar ?? ""]: lane === 2,
            [styles.hoveredThreadBar ?? ""]: threadId === hoveredThreadId,
            [styles.selectedThreadBar ?? ""]: threadId === selectedThreadId,
          })}
          key={threadId}
          onClick={() => onSelectThread(threadId)}
          onPointerEnter={() => report(threadId)}
          onPointerLeave={() => report(null)}
          style={{ height: box.height + 2 * verticalOutset, top: box.top - verticalOutset }}
          aria-hidden="true"
          data-md-ignore=""
          data-testid="thread-bar"
        />
      ))}
    </>
  );
}
