import { clsx } from "clsx";
import type { JSX } from "react";

import styles from "./DocumentView.module.css";
import type { SpanBox } from "./SpanBox";

/**
 * How far the bracket reaches above and below its structure
 */
const verticalOutset = 4;

export interface StructureBracketProps {
  /**
   * Where the structure is
   */
  box: SpanBox;

  /**
   * Whether the user is picking the structure, which marks the bracket out
   */
  isPicked: boolean;
}

/**
 * The bracket in the gutter's outer lane beside the table, list, quote, alert or section the gutter offers a comment on
 */
export function StructureBracket({ box, isPicked }: StructureBracketProps): JSX.Element {
  return (
    <div
      className={clsx(styles.structureBracket, { [styles.pickedStructureBracket ?? ""]: isPicked })}
      style={{ height: box.height + 2 * verticalOutset, top: box.top - verticalOutset }}
      aria-hidden="true"
      data-md-ignore=""
      data-testid="structure-bracket"
    />
  );
}
