import { describe, expect, test } from "vitest";

import { formatAppearanceCookies, readStoredAppearance } from "./appearanceCookies";

describe("appearanceCookies", () => {
  test("must read both settings when their cookies are among others", () => {
    const stored = readStoredAppearance("theme=x; markdown-review-mode=dark; other=a=b; markdown-review-palette=mist");

    expect(stored).toEqual({ mode: "dark", palette: "mist" });
  });

  test.each([
    { cookies: "", condition: "there are no cookies" },
    {
      cookies: "markdown-review-mode=dim; markdown-review-palette=pop",
      condition: "the values are not on their lists",
    },
    { cookies: "markdown-review-mode; markdown-review-palette=", condition: "the cookies have no values" },
  ])("must leave the settings out when $condition", ({ cookies }) => {
    expect(readStoredAppearance(cookies)).toEqual({});
  });

  test("must keep a setting whose value is on its list when the other's is not", () => {
    expect(readStoredAppearance("markdown-review-mode=light; markdown-review-palette=pop")).toEqual({ mode: "light" });
  });

  test("must format a cookie for every server on the host, for 400 days, when both settings are given", () => {
    expect(formatAppearanceCookies({ mode: "dark", palette: "dusk" })).toEqual([
      "markdown-review-mode=dark; Path=/; Max-Age=34560000; SameSite=Strict",
      "markdown-review-palette=dusk; Path=/; Max-Age=34560000; SameSite=Strict",
    ]);
  });

  test("must format only the given setting's cookie when one setting is given", () => {
    expect(formatAppearanceCookies({ palette: "bright" })).toEqual([
      "markdown-review-palette=bright; Path=/; Max-Age=34560000; SameSite=Strict",
    ]);
  });

  test("must read back what it formats when the cookies are stored", () => {
    const cookies = formatAppearanceCookies({ mode: "system", palette: "paper" })
      .map((cookie) => cookie.slice(0, cookie.indexOf(";")))
      .join("; ");

    expect(readStoredAppearance(cookies)).toEqual({ mode: "system", palette: "paper" });
  });
});
