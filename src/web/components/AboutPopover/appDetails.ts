import licenceText from "../../../../LICENSE?raw";
import { bugs, description, homepage, license, version } from "../../../../package.json";

const { origin, pathname } = new URL(homepage);

/**
 * What the About popover says about the app, read from `package.json` and `LICENSE` when the app is built. `copyright`
 * is the year and holder from the `Copyright (c)` line of `LICENSE`, or undefined when it has none.
 */
export const appDetails = {
  copyright: /^Copyright \(c\) (?<holder>.+)$/mu.exec(licenceText)?.groups?.holder,
  description,
  issuesUrl: bugs.url,
  licence: license,
  licenceUrl: `${origin}${pathname}/blob/v${version}/LICENSE`,
  repositoryUrl: homepage,
  version,
};
