import { Badge, Card, Cluster, Stack, Text } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useContext, useEffect, useRef } from "react";

import type { Anchor } from "../../../shared/review/anchorSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { describeLocation } from "../../review/describeLocation";
import { HoveredThreadContext } from "../../review/HoveredThreadContext";
import { useCommentEditorContext } from "../../review/useCommentEditorContext";
import { Quote } from "../Quote/Quote";

import { Message } from "./Message";
import { ThreadActions } from "./ThreadActions";
import styles from "./ThreadCard.module.css";

export interface ThreadCardProps {
  hasNewAgentMessage: boolean;
  isSelected: boolean;

  /**
   * Called after the card changes the thread on the server
   */
  onChanged: () => void;

  /**
   * Called when the user asks to see the thread in its doc
   */
  onSelect: (thread: Thread) => void;

  thread: Thread;
}

/**
 * One thread in the sidebar: where it is and its state, what it is on, its messages, and what the user can do
 */
export function ThreadCard({
  hasNewAgentMessage,
  isSelected,
  onChanged,
  onSelect,
  thread,
}: ThreadCardProps): JSX.Element {
  const { anchor, id, messages } = thread;
  const cardRef = useRef<HTMLElement>(null);
  const editor = useCommentEditorContext();
  const { hoveredThreadId, onFocusThread, onHoverThread } = useContext(HoveredThreadContext);
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);
  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- focus on the card's buttons hovers it
    <Card
      as="article"
      className={clsx(styles.card, {
        [styles.editing ?? ""]: editor.editingThreadId === id,
        [styles.hovered ?? ""]: hoveredThreadId === id,
        [styles.selected ?? ""]: isSelected,
      })}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onFocusThread(null);
        }
      }}
      onFocus={() => onFocusThread(id)}
      onPointerEnter={() => onHoverThread(id)}
      onPointerLeave={() => onHoverThread(null)}
      padding="sm"
      ref={cardRef}
      aria-label={`Thread #${id}`}
    >
      <Stack gap={2}>
        <Cluster gap={2} justify="between">
          <ThreadLocation onSelect={() => onSelect(thread)} thread={thread} />
          <ThreadBadges hasNewAgentMessage={hasNewAgentMessage} thread={thread} />
        </Cluster>
        <PassageQuote anchor={anchor} />
        {messages.length > 0 && (
          <Stack as="ol" className={styles.messages} gap={3} aria-label="Messages">
            {messages.map((message) => (
              <li key={message.at + message.author}>
                <Message author={message.author} body={message.body} sentAt={message.at} />
              </li>
            ))}
          </Stack>
        )}
        <ThreadActions onChanged={onChanged} thread={thread} />
      </Stack>
    </Card>
  );
}

function ThreadLocation({ onSelect, thread: { anchor, id } }: { onSelect: () => void; thread: Thread }): JSX.Element {
  return (
    <button className={styles.location} onClick={onSelect} type="button">
      <span className={styles.id}>#{id}</span> {describeLocation(anchor)}
    </button>
  );
}

function ThreadBadges({
  hasNewAgentMessage,
  thread: { anchor, status },
}: {
  hasNewAgentMessage: boolean;
  thread: Thread;
}): JSX.Element {
  return (
    <Cluster gap={1}>
      {status === "draft" && <Badge tone="warning">Draft</Badge>}
      {hasNewAgentMessage && <Badge tone="info">New reply</Badge>}
      {anchor.kind === "passage" && anchor.outdated && <Badge tone="warning">Outdated</Badge>}
      {status === "resolved" && <Badge tone="success">Resolved</Badge>}
    </Cluster>
  );
}

function PassageQuote({ anchor }: { anchor: Anchor }): JSX.Element | null {
  if (anchor.kind !== "passage") {
    return null;
  }
  return (
    <>
      <Quote text={anchor.anchoredText} />
      {anchor.quote !== anchor.anchoredText && (
        <Text as="p" size="sm" tone="muted">
          Originally: {anchor.quote}
        </Text>
      )}
    </>
  );
}
