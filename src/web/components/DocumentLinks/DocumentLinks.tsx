import { NavList, NavListGroup, NavListItem, Text } from "@krelborn/stylesui";
import type { JSX, MouseEvent } from "react";

import type { DocumentList } from "../../../shared/api/apiResponseSchemas";
import { documentPagePath } from "../../navigation/documentPagePath";
import { isPlainLeftClick } from "../../navigation/isPlainLeftClick";

export interface DocumentLinksProps {
  list: DocumentList;

  /**
   * Shows the app's page for a doc
   */
  onNavigate: (pagePath: string) => void;
}

/**
 * Links to the docs with comments, with their counts, and to the other docs opened recently
 */
export function DocumentLinks({ list, onNavigate }: DocumentLinksProps): JSX.Element {
  const recent = list.recent.filter((document) => !list.documents.some((count) => count.document === document));
  const follow = (event: MouseEvent<HTMLAnchorElement>, document: string): void => {
    if (isPlainLeftClick(event)) {
      event.preventDefault();
      onNavigate(documentPagePath(document));
    }
  };
  if (list.documents.length === 0 && recent.length === 0) {
    return (
      <Text as="p" size="sm">
        No docs yet. The agent opens a doc for review with <code>markdown-review open &lt;doc.md&gt;</code>.
      </Text>
    );
  }
  return (
    <NavList aria-label="Docs">
      {list.documents.length > 0 && (
        <NavListGroup headingLevel={2} title="With comments">
          {list.documents.map(({ document, draftCount, openCount }) => (
            <NavListItem
              href={documentPagePath(document)}
              key={document}
              onClick={(event) => follow(event, document)}
              trailing={`${openCount} open, ${draftCount} ${draftCount === 1 ? "draft" : "drafts"}`}
            >
              {document}
            </NavListItem>
          ))}
        </NavListGroup>
      )}
      {recent.length > 0 && (
        <NavListGroup headingLevel={2} title="Recently opened">
          {recent.map((document) => (
            <NavListItem href={documentPagePath(document)} key={document} onClick={(event) => follow(event, document)}>
              {document}
            </NavListItem>
          ))}
        </NavListGroup>
      )}
    </NavList>
  );
}
