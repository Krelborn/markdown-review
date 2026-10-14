import type { DocumentStructure } from "../../shared/markdown/DocumentStructure";
import type { DocumentText } from "../../shared/markdown/DocumentText";

/**
 * Names a structure of a doc for the user
 *
 * @param documentText the doc's canonical text, which holds a section's heading
 * @param structure the structure
 * @returns "the table", "the list", "the quote", the alert's kind, such as "the note", or the section and its heading,
 *   such as "the section “Goals”"
 */
export function describeStructure(documentText: DocumentText, structure: DocumentStructure): string {
  switch (structure.kind) {
    case "alert":
      return `the ${structure.alertKind}`;
    case "section":
      return `the section “${documentText.blocks[structure.firstBlock]?.text ?? ""}”`;
    default:
      return `the ${structure.kind}`;
  }
}
