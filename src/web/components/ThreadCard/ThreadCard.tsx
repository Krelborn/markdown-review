import { Badge, Button, Card, Cluster, Stack, Text } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useEffect, useRef } from "react";

import type { Anchor } from "../../../shared/review/anchorSchema";
import type { Thread } from "../../../shared/review/threadSchema";
import { describeLocation } from "../../review/describeLocation";
import { Quote } from "../Quote/Quote";

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
 * One thread in the sidebar: what it is on, its messages, the user's draft, and the actions the user can take
 */
export function ThreadCard({
  hasNewAgentMessage,
  isSelected,
  onChanged,
  onSelect,
  thread,
}: ThreadCardProps): JSX.Element {
  const { anchor, id, messages, status } = thread;
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (isSelected) {
      cardRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);
  return (
    <Card
      as="article"
      className={clsx(styles.card, { [styles.selected ?? ""]: isSelected })}
      padding="sm"
      ref={cardRef}
      aria-label={`Thread #${id}`}
    >
      <Stack gap={2}>
        <Cluster gap={2} justify="between">
          <Button onClick={() => onSelect(thread)} size="sm" variant="ghost">
            #{id} {describeLocation(anchor)}
          </Button>
          <Cluster gap={1}>
            {hasNewAgentMessage && <Badge tone="info">New</Badge>}
            {anchor.kind === "passage" && anchor.outdated && <Badge tone="warning">Outdated</Badge>}
            {status === "resolved" && <Badge tone="success">Resolved</Badge>}
          </Cluster>
        </Cluster>
        <PassageQuote anchor={anchor} />
        {messages.length > 0 && (
          <Stack as="ol" className={styles.messages} gap={2} aria-label="Messages">
            {messages.map((message) => (
              <li key={message.at + message.author}>
                <Text size="sm" weight="bold">
                  {message.author === "user" ? "You" : "Agent"}
                </Text>{" "}
                <Text as="p" className={styles.body} size="sm">
                  {message.body}
                </Text>
              </li>
            ))}
          </Stack>
        )}
        <ThreadActions onChanged={onChanged} thread={thread} />
      </Stack>
    </Card>
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
