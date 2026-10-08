// jsdom has no Popover API: a button's popovertarget does nothing, and its stylesheet hides every popover because none
// ever matches :popover-open. These stand-ins open and close popovers as browsers do, sending the beforetoggle and
// toggle events StylesUI's popovers listen for, and mark an open popover with an attribute that undoes the hiding.

const openAttribute = "data-popover-open";

const popoverStyle = document.createElement("style");
popoverStyle.textContent = `[popover][${openAttribute}] { display: block !important; }`;
document.head.append(popoverStyle);

const openingStates = { newState: "open", oldState: "closed" };

const closingStates = { newState: "closed", oldState: "open" };

function changePopover(popover: HTMLElement, open: boolean): void {
  const states = open ? openingStates : closingStates;
  const beforeToggle = Object.assign(new Event("beforetoggle", { cancelable: true }), states);
  if (popover.hasAttribute(openAttribute) !== open && popover.dispatchEvent(beforeToggle)) {
    popover.toggleAttribute(openAttribute, open);
    popover.dispatchEvent(Object.assign(new Event("toggle"), states));
  }
}

HTMLElement.prototype.showPopover = function showPopover(this: HTMLElement): void {
  changePopover(this, true);
};

HTMLElement.prototype.hidePopover = function hidePopover(this: HTMLElement): void {
  changePopover(this, false);
};

HTMLElement.prototype.togglePopover = function togglePopover(this: HTMLElement): boolean {
  changePopover(this, !this.hasAttribute(openAttribute));
  return this.hasAttribute(openAttribute);
};

const matches = Element.prototype.matches;

Element.prototype.matches = function matchesWithPopoverOpen(this: Element, selectors: string): boolean {
  return matches.call(this, selectors.replaceAll(":popover-open", `[${openAttribute}]`));
} as typeof matches;

document.addEventListener("click", (event) => {
  const trigger = event.target instanceof Element ? event.target.closest("button[popovertarget]") : null;
  const popover = document.getElementById(trigger?.getAttribute("popovertarget") ?? "");
  popover?.togglePopover();
});
