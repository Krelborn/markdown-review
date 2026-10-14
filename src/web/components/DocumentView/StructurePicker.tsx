import { clsx } from "clsx";
import type { JSX } from "react";

import type { BlockSpan } from "../../../shared/markdown/BlockSpan";

import { BlockTarget } from "./BlockTarget";
import styles from "./DocumentView.module.css";
import { StructureBracket } from "./StructureBracket";
import type { OfferedStructure } from "./useOfferedStructure";

export interface StructurePickerProps {
  /**
   * Whether the user is picking the structure, with the pointer in the bracket lane
   */
  isPicking: boolean;

  /**
   * The structure the gutter offers a comment on, or null
   */
  offeredStructure: OfferedStructure | null;

  /**
   * Called with the structure's blocks when the user clicks the bracket lane beside it
   */
  onComment: (span: BlockSpan) => void;
}

/**
 * The gutter's outer lane, where a bracket runs beside the table, list, quote, alert or section the gutter offers, and a
 * click starts a comment on all of it; while the user picks it, the structure is framed and named
 */
export function StructurePicker({ isPicking, offeredStructure, onComment }: StructurePickerProps): JSX.Element {
  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the + is the control for keyboards and screen readers; the lane only widens what the pointer can pick */}
      <div
        className={clsx(styles.bracketLane, { [styles.offeringBracketLane ?? ""]: offeredStructure !== null })}
        onClick={() => {
          if (offeredStructure !== null) {
            onComment(offeredStructure.structure);
          }
        }}
        aria-hidden="true"
        data-bracket-lane=""
        data-md-ignore=""
        data-testid="bracket-lane"
      />
      {offeredStructure !== null && <StructureBracket box={offeredStructure.box} isPicked={isPicking} />}
      {offeredStructure !== null && isPicking && (
        <BlockTarget box={offeredStructure.box} label={`Comment on ${offeredStructure.description}`} />
      )}
    </>
  );
}
