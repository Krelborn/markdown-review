// jsdom has no pointer capture; without it, the pointer's events go to the elements under it, which the tests choose

Element.prototype.setPointerCapture = () => {};

Element.prototype.releasePointerCapture = () => {};

Element.prototype.hasPointerCapture = () => false;
