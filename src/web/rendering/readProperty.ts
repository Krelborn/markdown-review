import { stringify } from "yaml";

/**
 * A frontmatter value, read for display
 */
export type Property =
  | { isTicked: boolean; kind: "checkbox" }
  | { kind: "date" | "link" | "number" | "text"; text: string }
  | { kind: "empty" }
  | { items: string[]; kind: "list" | "tags" }
  | { kind: "nested"; text: string };

const isoDate = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Reads a frontmatter value for display
 *
 * @param key the value's key; a list under `tags` is read as tags
 * @param value the value as YAML parsed it
 * @param scalarSource the value as written, when it is a scalar; a number is shown as written
 * @returns the value, with the kind that decides how it is shown and which icon its key gets; a nested value is shown
 *   as YAML
 */
export function readProperty(key: string, value: unknown, scalarSource?: string): Property {
  if (Array.isArray(value)) {
    return readList(key, value);
  }
  switch (typeof value) {
    case "boolean":
      return { isTicked: value, kind: "checkbox" };
    case "number":
      return { kind: "number", text: scalarSource ?? String(value) };
    case "string":
      return readText(value);
    default:
      return value === null || value === undefined ? { kind: "empty" } : { kind: "nested", text: toYaml(value) };
  }
}

function readList(key: string, items: unknown[]): Property {
  if (items.length === 0) {
    return { kind: "empty" };
  }
  if (!items.every(isScalar)) {
    return { kind: "nested", text: toYaml(items) };
  }
  return { items: items.map(String), kind: key === "tags" ? "tags" : "list" };
}

function isScalar(value: unknown): value is boolean | number | string {
  return typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}

function readText(text: string): Property {
  if (text === "") {
    return { kind: "empty" };
  }
  if (URL.canParse(text) && ["http:", "https:"].includes(new URL(text).protocol)) {
    return { kind: "link", text };
  }
  return { kind: isoDate.test(text) ? "date" : "text", text };
}

function toYaml(value: unknown): string {
  return stringify(value).trimEnd();
}
