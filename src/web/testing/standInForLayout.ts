// jsdom lays nothing out, so it cannot scroll; this stand-in lets components that scroll an element into view run
Element.prototype.scrollIntoView = () => {};
