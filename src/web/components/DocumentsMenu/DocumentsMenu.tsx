import { Alert, Button, ChevronDownIcon, Popover, usePopover } from "@krelborn/stylesui";
import type { JSX } from "react";
import { useState } from "react";

import type { DocumentList } from "../../../shared/api/apiResponseSchemas";
import { describeFailure } from "../../api/describeFailure";
import { useReviewApi } from "../../api/useReviewApi";
import { DocumentLinks } from "../DocumentLinks/DocumentLinks";

export interface DocumentsMenuProps {
  /**
   * Shows another page of the app
   */
  onNavigate: (pagePath: string) => void;
}

/**
 * Lists the docs with comments and the docs opened recently, so the user can move between them
 */
export function DocumentsMenu({ onNavigate }: DocumentsMenuProps): JSX.Element {
  const api = useReviewApi();
  const [list, setList] = useState<DocumentList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const popover = usePopover({
    onOpenChange: (open) => {
      if (open) {
        api.readDocuments().then(setList, (failure: unknown) => setError(describeFailure(failure)));
      }
    },
  });
  return (
    <>
      <Button {...popover.getTriggerProps()} size="sm" variant="secondary">
        Docs <ChevronDownIcon />
      </Button>
      <Popover {...popover.getOverlayProps()}>
        {error !== null && <Alert tone="danger">{error}</Alert>}
        {list !== null && (
          <DocumentLinks
            list={list}
            onNavigate={(pagePath) => {
              popover.close();
              onNavigate(pagePath);
            }}
          />
        )}
      </Popover>
    </>
  );
}
