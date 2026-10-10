import { afterEach, describe, expect, test, vi } from "vitest";

import { mountDocument } from "../testing/mountDocument";

import { offsetAtPoint } from "./offsetAtPoint";

const source = "# Plan\n\nWe cache results for 24h.\n";

afterEach(() => {
  Reflect.deleteProperty(document, "caretPositionFromPoint");
  Reflect.deleteProperty(document, "caretRangeFromPoint");
});

describe("offsetAtPoint", () => {
  test("must find the character under the point when the browser reports a caret position", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const { node, offset } = pointAt("results");
    Object.assign(document, { caretPositionFromPoint: vi.fn(() => ({ offset, offsetNode: node })) });

    expect(offsetAtPoint(container, documentText, 120, 40)).toBe(documentText.text.indexOf("results"));
  });

  test("must find the character under the point when the browser only reports a caret range", async () => {
    const { container, documentText, pointAt } = await mountDocument(source);
    const caret = document.createRange();
    caret.setStart(pointAt("24h").node, pointAt("24h").offset);
    Object.assign(document, { caretPositionFromPoint: undefined, caretRangeFromPoint: vi.fn(() => caret) });

    expect(offsetAtPoint(container, documentText, 120, 40)).toBe(documentText.text.indexOf("24h"));
  });

  test("must find nothing when the point is outside the doc", async () => {
    const { container, documentText } = await mountDocument(source);
    const outside = document.createElement("p");
    outside.textContent = "Sidebar";
    document.body.append(outside);
    Object.assign(document, { caretPositionFromPoint: vi.fn(() => ({ offset: 0, offsetNode: outside.firstChild })) });

    expect(offsetAtPoint(container, documentText, 900, 40)).toBeNull();
  });
});
