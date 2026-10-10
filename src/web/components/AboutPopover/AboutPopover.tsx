import { Cluster, Divider, IconButton, InfoIcon, Link, Popover, Stack, Text, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";

import { AppIcon } from "../AppIcon/AppIcon";

import { appDetails } from "./appDetails";

/**
 * The About button, which opens a popover with the app's version and licence, and links to its repository, its issues
 * and the licences of the code it bundles, each opening in a new tab
 */
export function AboutPopover(): JSX.Element {
  const popover = usePopover();
  return (
    <>
      <IconButton
        {...popover.getTriggerProps()}
        label="About Markdown Review"
        placement="bottom"
        size="sm"
        variant="ghost"
      >
        <InfoIcon />
      </IconButton>
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
