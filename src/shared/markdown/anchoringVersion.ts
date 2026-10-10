/**
 * The version of the rules that turn a doc's source into its canonical text; it goes up whenever the same source would
 * give different canonical text, so that threads anchored under the old rules are re-anchored
 */
export const anchoringVersion = 2;
