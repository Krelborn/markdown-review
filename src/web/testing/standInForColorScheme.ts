// jsdom has no matchMedia; this stand-in answers every media query as not matching, as a browser in light mode does
// for `prefers-color-scheme: dark`, and never reports a change

window.matchMedia = (media) =>
  Object.assign(new EventTarget(), { addListener() {}, matches: false, media, onchange: null, removeListener() {} });
