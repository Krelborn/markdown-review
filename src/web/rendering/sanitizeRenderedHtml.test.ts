import { describe, expect, test } from "vitest";

import { sanitizeRenderedHtml } from "./sanitizeRenderedHtml";

describe("sanitizeRenderedHtml", () => {
  test("must remove scripts when the doc's raw HTML contains one", () => {
    expect(sanitizeRenderedHtml('<p data-md-block="0">text</p><script>alert(1)</script>')).toBe(
      '<p data-md-block="0">text</p>'
    );
  });

  test("must remove the form but keep its text when the doc's raw HTML could post to the server", () => {
    const html = '<form method="post" action="/api/threads/3/resolve"><button>Looks good, continue</button></form>';

    expect(sanitizeRenderedHtml(html)).toBe("<button>Looks good, continue</button>");
  });

  test("must remove style elements when the doc's raw HTML could restyle the app", () => {
    expect(sanitizeRenderedHtml("<p>text</p><style>.sidebar{display:none}</style>")).toBe("<p>text</p>");
  });

  test("must keep block attributes and task-list checkboxes when the doc has a task list", () => {
    const html =
      '<span data-md-block="0" data-md-start="1" data-md-end="1"><input type="checkbox" disabled=""><label>todo</label></span>';

    expect(sanitizeRenderedHtml(html)).toBe(html);
  });
});
