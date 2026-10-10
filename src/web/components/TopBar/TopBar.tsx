import { Heading, Link } from "@krelborn/stylesui";
import type { JSX } from "react";

import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";
import { AboutPopover } from "../AboutPopover/AboutPopover";
import { AppIcon } from "../AppIcon/AppIcon";
import { DocumentSwitcher } from "../DocumentSwitcher/DocumentSwitcher";

import styles from "./TopBar.module.css";

export interface TopBarProps {
  /**
   * The doc on screen, or null on the docs list
   */
  documentPath: string | null;

  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;
}

/**
 * The bar across the top of the page: the app's icon, which goes to the docs list; where the user is, which opens the
 * menu of docs to go to; and, at the right end, the About button
 */
export function TopBar({ documentPath, onNavigate }: TopBarProps): JSX.Element {
  return (
    <header className={styles.topBar}>
      <Link
        className={styles.home}
        href="/"
        onClick={(event) => {
          if (isPlainLeftClick(event)) {
            event.preventDefault();
            onNavigate("/");
          }
        }}
        title="Markdown Review: all docs"
        tone="inherit"
      >
        <AppIcon />
      </Link>
      {documentPath === null ? (
        <Heading className={styles.title} level={1} size="md">
          All docs
        </Heading>
      ) : (
        <DocumentSwitcher className={styles.title} documentPath={documentPath} onNavigate={onNavigate} />
      )}
      <AboutPopover />
    </header>
  );
}
