import { describe, expect, test } from "vitest";

import { BrowserTabs } from "./BrowserTabs";

describe("BrowserTabs", () => {
  test("must send the page to the most recently connected tab only when several tabs are connected", () => {
    const tabs = new BrowserTabs();
    const shown: string[] = [];
    tabs.connect({ navigate: (url) => shown.push(`first ${url}`) });
    tabs.connect({ navigate: (url) => shown.push(`second ${url}`) });

    const navigated = tabs.navigateLatest("/document/docs/plan.md");

    expect(navigated).toBe(true);
    expect(shown).toEqual(["second /document/docs/plan.md"]);
  });

  test("must fall back to the earlier tab when the latest tab disconnects", () => {
    const tabs = new BrowserTabs();
    const shown: string[] = [];
    tabs.connect({ navigate: (url) => shown.push(`first ${url}`) });
    const disconnect = tabs.connect({ navigate: (url) => shown.push(`second ${url}`) });

    disconnect();
    tabs.navigateLatest("/");

    expect(shown).toEqual(["first /"]);
  });

  test("must report that nothing was shown when no tab is connected", () => {
    expect(new BrowserTabs().navigateLatest("/")).toBe(false);
  });
});
