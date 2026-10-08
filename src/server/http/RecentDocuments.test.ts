import { describe, expect, test } from "vitest";

import { RecentDocuments } from "./RecentDocuments";

describe("RecentDocuments", () => {
  test("must list docs newest first without repeats when a doc is opened again", () => {
    const recent = new RecentDocuments();

    recent.add("docs/spec.md");
    recent.add("docs/plan.md");
    recent.add("docs/spec.md");

    expect(recent.list()).toEqual(["docs/spec.md", "docs/plan.md"]);
  });

  test("must keep only the ten most recent docs when more are opened", () => {
    const recent = new RecentDocuments();

    for (let index = 1; index <= 12; index++) {
      recent.add(`docs/${index}.md`);
    }

    expect(recent.list()).toEqual(Array.from({ length: 10 }, (_, index) => `docs/${12 - index}.md`));
  });
});
