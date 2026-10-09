// jsdom lays nothing out, so it has no ResizeObserver, no geometry for ranges, no caret at a point and no scrolling;
// these stand-ins let components that measure or scroll the page run, with every box empty and at the top left and no
// text under any point

class StandInResizeObserver {
  public disconnect(): void {}

  public observe(): void {}

  public unobserve(): void {}
}

Object.assign(globalThis, { ResizeObserver: StandInResizeObserver });

Range.prototype.getBoundingClientRect = () => new DOMRect();

Range.prototype.getClientRects = () => Object.assign([], { item: () => null });

Element.prototype.scrollIntoView = () => {};

Document.prototype.caretPositionFromPoint = () => null;
