// jsdom has no CSS Custom Highlight API. This stand-in keeps the registered highlights, so tests can read the ranges
// the app highlights.

class StandInHighlight extends Set<AbstractRange> {
  public constructor(...ranges: AbstractRange[]) {
    super(ranges);
  }
}

Object.assign(globalThis, { Highlight: StandInHighlight });
Object.assign(globalThis.CSS, { highlights: new Map<string, StandInHighlight>() });
