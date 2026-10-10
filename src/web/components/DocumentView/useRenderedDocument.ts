import { useEffect, useState } from "react";

import type { DocumentSource } from "../../../shared/api/apiResponseSchemas";
import { createDocumentText } from "../../../shared/markdown/createDocumentText";
import type { DocumentText } from "../../../shared/markdown/DocumentText";
import { describeFailure } from "../../api/describeFailure";
import { renderDocument } from "../../rendering/renderDocument";

export interface RenderedDocument {
  documentText: DocumentText;

  /**
   * The hash of the source this is a rendering of, which a comment made on it is sent with
   */
  hash: string;

  html: string;
}

export interface RenderingState {
  error: string | null;

  /**
   * The doc's last rendering, kept while a newer source renders so the page does not go blank
   */
  rendered: RenderedDocument | null;
}

/**
 * Renders a doc's source again whenever it changes
 */
export function useRenderedDocument({ hash, path, source }: DocumentSource): RenderingState {
  const [state, setState] = useState<RenderingState>({ error: null, rendered: null });
  useEffect(() => {
    let isCurrent = true;
    renderDocument(source, path).then(
      (html) => {
        if (isCurrent) {
          setState({ error: null, rendered: { documentText: createDocumentText(source), hash, html } });
        }
      },
      (failure: unknown) => {
        if (isCurrent) {
          setState((previous) => ({ ...previous, error: describeFailure(failure) }));
        }
      }
    );
    return () => {
      isCurrent = false;
    };
  }, [hash, path, source]);
  return state;
}
