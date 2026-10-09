import { Avatar, Badge, Cluster, Stack, Text } from "@krelborn/stylesui";
import { clsx } from "clsx";
import type { JSX } from "react";
import { useState } from "react";

import { formatMessageTime } from "../../review/formatMessageTime";

import styles from "./ThreadCard.module.css";

export interface MessageProps {
  author: "agent" | "user";
  body: string;

  /**
   * When the message was sent, or null for the user's draft reply, which shows a Draft badge in its place
   */
  sentAt: string | null;
}

/**
 * One message in a thread: who wrote it, when, and what it says
 */
export function Message({ author, body, sentAt }: MessageProps): JSX.Element {
  const name = author === "user" ? "You" : "Agent";
  const [now] = useState(() => new Date());
  return (
    <div className={styles.message}>
      <Avatar className={clsx({ [styles.agent ?? ""]: author === "agent" })} name={name} size="xs" aria-hidden={true} />
      <Stack gap={1}>
        <Cluster gap={2}>
          <Text size="sm" weight="bold">
            {name}
          </Text>
          {sentAt === null ? (
            <Badge tone="warning">Draft</Badge>
          ) : (
            <time
              className={styles.time}
              dateTime={sentAt}
              title={new Date(sentAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            >
              {formatMessageTime(sentAt, now)}
            </time>
          )}
        </Cluster>
        <Text as="p" className={styles.body} size="sm">
          {body}
        </Text>
      </Stack>
    </div>
  );
}
