import { Heading, Link } from "@krelborn/stylesui";
import type { JSX } from "react";

import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";
import { DocumentsMenu } from "../DocumentsMenu/DocumentsMenu";

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
 * The bar across the top of the page: where the user is, and the menu of docs to go to
 */
export function TopBar({ documentPath, onNavigate }: TopBarProps): JSX.Element {
  return (
    <header className={styles.topBar}>
      <Link
        className={styles.appLink}
        href="/"
        onClick={(event) => {
          if (isPlainLeftClick(event)) {
            event.preventDefault();
            onNavigate("/");
          }
        }}
        tone="inherit"
        underline="hover"
      >
        Markdown Review
      </Link>
      <Heading className={styles.path} level={1} size="md" title={documentPath ?? undefined}>
        <span className={styles.pathText}>{documentPath === null ? "Docs" : <PathText path={documentPath} />}</span>
      </Heading>
      <DocumentsMenu onNavigate={onNavigate} />
    </header>
  );
}

function PathText({ path }: { path: string }): JSX.Element {
  const fileStart = path.lastIndexOf("/") + 1;
  return (
    <>
      <span className={styles.folders}>{path.slice(0, fileStart)}</span>
      {path.slice(fileStart)}
    </>
  );
}
