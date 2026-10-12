import { Cluster, Divider, IconButton, InfoIcon, Link, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";

import type { AvailableUpdate } from "../../api/useAvailableUpdate";
import { AppIcon } from "../AppIcon/AppIcon";

import styles from "./AboutPopover.module.css";
import { appDetails } from "./appDetails";

export interface AboutPopoverProps {
  /**
   * A newer version and the command that installs it, or null when there is none
   */
  update: AvailableUpdate | null;
}

/**
 * The About button, which opens a popover with the app's version and licence, any newer version, and links to its
 * repository, its issues and the licences of the code it bundles, each opening in a new tab. The button carries a dot
 * while a newer version is out.
 */
export function AboutPopover({ update }: AboutPopoverProps): JSX.Element {
  const popover = usePopover({ placement: "bottom-end" });
  return (
    <>
      <span className={styles.trigger}>
        <IconButton
          {...popover.getTriggerProps()}
          label={update === null ? "About Markdown Review" : "About Markdown Review, update available"}
          placement="bottom"
          size="sm"
          variant="ghost"
        >
          <InfoIcon />
        </IconButton>
        {update !== null && <span aria-hidden="true" className={styles.updateDot} />}
      </span>
      <Popover {...popover.getOverlayProps()} aria-label="About Markdown Review" role="dialog">
        <Stack gap={3}>
          <Cluster align="center" gap={2}>
            <AppIcon />
            <Stack gap={0}>
              <Text weight="bold">Markdown Review</Text>
              <Text size="sm" tone="muted">
                Version {appDetails.version}
              </Text>
            </Stack>
          </Cluster>
          {update !== null && (
            <Text as="p" size="sm">
              Version {update.version} is available. Ask your agent to update it
              {update.command === null ? (
                "."
              ) : (
                <>
                  , or run <code>{update.command}</code>
                </>
              )}
            </Text>
          )}
          <Text as="p" size="sm">
            {appDetails.description}
          </Text>
          <Stack gap={0}>
            <Link href={appDetails.licenceUrl} rel="noopener noreferrer" target="_blank">
              {appDetails.licence} License
            </Link>
            {appDetails.copyright !== undefined && (
              <Text size="sm" tone="muted">
                © {appDetails.copyright}
              </Text>
            )}
          </Stack>
          <Divider />
          <Cluster gap={3}>
            <Link href={appDetails.repositoryUrl} rel="noopener noreferrer" target="_blank">
              GitHub
            </Link>
            <Link href={appDetails.issuesUrl} rel="noopener noreferrer" target="_blank">
              Report an issue
            </Link>
            <Link href="/licences" rel="noopener noreferrer" target="_blank">
              Third-party licences
            </Link>
          </Cluster>
        </Stack>
      </Popover>
    </>
  );
}
