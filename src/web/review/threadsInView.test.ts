import { describe, expect, test } from "vitest";

import { buildPassageAnchor, buildThread } from "../../shared/review/testing/reviewBuilders";

import { threadsInView } from "./threadsInView";

const planThread = buildThread({ anchor: buildPassageAnchor(), id: 1 });

const reviewThread = buildThread({ anchor: { kind: "review" }, id: 2 });

const specThread = buildThread({ anchor: buildPassageAnchor({ document: "docs/spec.md" }), id: 3 });

describe("threadsInView", () => {
  test("must list this doc's and the review's threads, and offer no choice, when no other doc has threads", () => {
    const inView = threadsInView([planThread, reviewThread], "docs/plan.md", "document", null);

    expect(inView).toMatchObject({
      hasChoice: false,
      showsDocuments: false,
      threads: [planThread, reviewThread],
      view: "document",
    });
  });

  test("must offer a choice, and count each view's threads, when another doc has threads", () => {
    const inView = threadsInView([planThread, reviewThread, specThread], "docs/plan.md", "document", null);

    expect(inView).toMatchObject({
      counts: { all: 3, document: 2 },
      hasChoice: true,
      threads: [planThread, reviewThread],
    });
  });

  test("must list every thread under its doc when the user chooses All docs", () => {
    const inView = threadsInView([planThread, reviewThread, specThread], "docs/plan.md", "all", null);

    expect(inView).toMatchObject({
      showsDocuments: true,
      threads: [planThread, reviewThread, specThread],
      view: "all",
    });
  });

  test("must list This doc when the user chose All docs but no other doc has threads", () => {
    const inView = threadsInView([planThread, reviewThread], "docs/plan.md", "all", null);

    expect(inView).toMatchObject({ threads: [planThread, reviewThread], view: "document" });
  });

  test("must list the thread being written to, under its doc, when it is on another doc", () => {
    const inView = threadsInView([planThread, specThread], "docs/plan.md", "document", 3);

    expect(inView).toMatchObject({
      counts: { all: 2, document: 2 },
      showsDocuments: true,
      threads: [planThread, specThread],
    });
  });

  test("must list every thread under its doc, and offer no choice, when the docs list is on screen", () => {
    const inView = threadsInView([planThread, specThread], null, "document", null);

    expect(inView).toMatchObject({ hasChoice: false, showsDocuments: true, threads: [planThread, specThread] });
  });
});
