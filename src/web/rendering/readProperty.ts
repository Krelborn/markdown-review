/**
 * A frontmatter value, read for display
 */
export type Property =
  | { isTicked: boolean; kind: "checkbox" }
  | { kind: "date" | "link" | "number" | "text"; text: string }
  | { kind: "empty" }
  | { items: string[]; kind: "list" | "tags" }
  | { kind: "nested"; value: unknown };

const isoDate = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Reads a frontmatter value for display
 *
 * @param key the value's key; a list under `tags` is read as tags
 * @param value the value as YAML parsed it
 * @returns the value, with the kind that decides how it is shown and which icon its key gets
 */
export function readProperty(key: string, value: unknown): Property {
  if (Array.isArray(value)) {
    return readList(key, value);
  }
  switch (typeof value) {
    case "boolean":
      return { isTicked: value, kind: "checkbox" };
    case "number":
      return { kind: "number", text: String(value) };
    case "string":
      return { kind: textKind(value), text: value };
    default:
      return value === null || value === undefined ? { kind: "empty" } : { kind: "nested", value };
  }
}

function readList(key: string, items: unknown[]): Property {
  if (!items.every(isScalar)) {
    return { kind: "nested", value: items };
  }
  return { items: items.map(String), kind: key === "tags" ? "tags" : "list" };
}

function isScalar(value: unknown): value is boolean | number | string {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}

function textKind(text: string): "date" | "link" | "text" {
  if (URL.canParse(text) && ["http:", "https:"].includes(new URL(text).protocol)) {
    return "link";
  }
  return isoDate.test(text) ? "date" : "text";
}
