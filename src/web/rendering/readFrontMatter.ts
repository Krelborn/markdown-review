import type { Document, Pair } from "yaml";
import { isMap, isNode, isScalar, parseDocument } from "yaml";

import type { Property } from "./readProperty";
import { readProperty } from "./readProperty";

/**
 * A top-level key of a doc's frontmatter, with its value read for display
 */
export interface FrontMatterEntry {
  key: string;
  property: Property;
}

/**
 * Reads a doc's frontmatter for display
 *
 * @param yaml the YAML between the frontmatter's fences
 * @returns each top-level key and its value in source order, with keys and numbers as written; null when the YAML is
 *   invalid or its top level is not a mapping
 */
export function readFrontMatter(yaml: string): FrontMatterEntry[] | null {
  const yamlDocument = parseDocument(yaml);
  const { contents } = yamlDocument;
  if (yamlDocument.errors.length > 0 || !(contents === null || isMap(contents))) {
    return null;
  }
  try {
    return (contents?.items ?? []).map((pair) => readEntry(pair, yamlDocument, yaml));
  } catch (error) {
    // The parser finds an alias with no anchor, or one that expands too far, only when it builds a value
    if (error instanceof ReferenceError) {
      return null;
    }
    throw error;
  }
}

function readEntry({ key, value }: Pair, yamlDocument: Document.Parsed, yaml: string): FrontMatterEntry {
  const keyText = readKey(key, yaml);
  const parsedValue: unknown = isNode(value) ? value.toJS(yamlDocument) : value;
  return { key: keyText, property: readProperty(keyText, parsedValue, isScalar(value) ? value.source : undefined) };
}

function readKey(key: unknown, yaml: string): string {
  if (isScalar(key)) {
    return key.source ?? String(key.value);
  }
  const range = isNode(key) ? key.range : null;
  return range ? yaml.slice(range[0], range[1]) : String(key);
}
