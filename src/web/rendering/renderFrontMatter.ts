import type { Property } from "./readProperty";
import { readProperty } from "./readProperty";

type Stringify = (value: unknown) => string;

/**
 * Shows a rendered doc's frontmatter as a Properties panel in place of its YAML, loading the YAML parser only when the
 * doc has frontmatter
 *
 * @param container the rendered doc, before it is inserted into the page
 * @returns once the panel is built; invalid YAML, or YAML whose top level is not a mapping, stays as code under a
 *   "frontmatter" header
 */
export async function renderFrontMatter(container: ParentNode): Promise<void> {
  // Frontmatter is always the doc's first block, and the doc's own HTML may carry the attribute anywhere
  const block = container.firstElementChild;
  if (block === null || !block.hasAttribute("data-front-matter")) {
    return;
  }
  const { parseDocument, stringify } = await import("yaml");
  const properties = readYaml(parseDocument(block.textContent));
  if (properties === null || isMapping(properties)) {
    block.replaceChildren(createPropertiesPanel(block.ownerDocument, Object.entries(properties ?? {}), stringify));
  } else {
    block.setAttribute("data-language", "frontmatter");
  }
}

/**
 * @returns the value the YAML holds, or undefined when the YAML is invalid
 */
function readYaml(yamlDocument: { errors: readonly unknown[]; toJS: () => unknown }): unknown {
  if (yamlDocument.errors.length > 0) {
    return undefined;
  }
  try {
    return yamlDocument.toJS();
  } catch (error) {
    // The parser finds an alias with no anchor, or one that expands too far, only when it builds the value
    if (error instanceof ReferenceError) {
      return undefined;
    }
    throw error;
  }
}

function isMapping(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createPropertiesPanel(page: Document, entries: [string, unknown][], stringify: Stringify): HTMLElement {
  const panel = createElement(page, "details", "", { "data-properties": "", open: "" });
  panel.append(createFlexContainer(page, "summary", "Properties", {}), createPropertyList(page, entries, stringify));
  return panel;
}

function createPropertyList(page: Document, entries: [string, unknown][], stringify: Stringify): HTMLElement {
  if (entries.length === 0) {
    return createElement(page, "p", "No properties", { "data-empty": "" });
  }
  const list = page.createElement("dl");
  for (const [key, value] of entries) {
    const property = readProperty(key, value);
    const definition = page.createElement("dd");
    definition.append(...createValueElements(page, property, stringify));
    list.append(createFlexContainer(page, "dt", key, { "data-type": property.kind }), definition);
  }
  return list;
}

function createValueElements(page: Document, property: Property, stringify: Stringify): HTMLElement[] {
  switch (property.kind) {
    case "checkbox":
      return [createCheckbox(page, property.isTicked)];
    case "empty":
      return [createElement(page, "span", "Empty", { "data-empty": "" })];
    case "link":
      return [createElement(page, "a", property.text, { href: property.text })];
    case "list":
    case "tags": {
      const attributes: Record<string, string> =
        property.kind === "tags" ? { "data-chip": "", "data-tag": "" } : { "data-chip": "" };
      return property.items.map((item) => createElement(page, "span", item, attributes));
    }
    case "nested":
      return [createElement(page, "pre", stringify(property.value).trimEnd(), {})];
    default:
      return [createElement(page, "span", property.text, {})];
  }
}

function createCheckbox(page: Document, isTicked: boolean): HTMLElement {
  const checkbox = createElement(page, "input", "", { disabled: "", type: "checkbox" });
  if (isTicked) {
    checkbox.setAttribute("checked", "");
  }
  return checkbox;
}

// Safari paints no comment highlight on text whose parent is a flex container, as the summary, the keys and the values
// are, so their text goes in elements of its own
function createFlexContainer(
  page: Document,
  tagName: string,
  text: string,
  attributes: Record<string, string>
): HTMLElement {
  const container = createElement(page, tagName, "", attributes);
  container.append(createElement(page, "span", text, {}));
  return container;
}

// Attributes rather than properties, since the panel is built in a template and only its markup reaches the page
function createElement(page: Document, tagName: string, text: string, attributes: Record<string, string>): HTMLElement {
  const element = page.createElement(tagName);
  element.textContent = text;
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}
