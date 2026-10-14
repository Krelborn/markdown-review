const modeKey = "markdown-review-mode";

for (const button of document.querySelectorAll("[data-copy]")) {
  button.addEventListener("click", async () => {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.dataset.copied = "";
    button.setAttribute("aria-label", "Copied");
    setTimeout(() => {
      delete button.dataset.copied;
      button.setAttribute("aria-label", "Copy");
    }, 1500);
  });
}

for (const button of document.querySelectorAll("[data-mode-toggle]")) {
  button.addEventListener("click", () => {
    const root = document.documentElement;
    const isDark =
      root.dataset.suiMode === "dark" ||
      (root.dataset.suiMode !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.suiMode = isDark ? "light" : "dark";
    localStorage.setItem(modeKey, root.dataset.suiMode);
  });
}

for (const list of document.querySelectorAll("[role=tablist]")) {
  const tabs = [...list.querySelectorAll("[role=tab]")];
  const select = (chosen) => {
    for (const tab of tabs) {
      const isChosen = tab === chosen;
      tab.setAttribute("aria-selected", String(isChosen));
      tab.tabIndex = isChosen ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !isChosen;
    }
    chosen.focus();
  };
  for (const tab of tabs) {
    tab.addEventListener("click", () => select(tab));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (step !== undefined) {
        select(tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length]);
      }
    });
  }
}

const contents = document.querySelector(".docs-nav");
if (contents !== null) {
  const links = new Map([...contents.querySelectorAll("a[href^='#']")].map((link) => [link.hash.slice(1), link]));
  const sections = [...links.keys()].flatMap((id) => document.getElementById(id) ?? []);
  const isAtBottom = () => innerHeight + scrollY >= document.documentElement.scrollHeight - 1;
  const isInView = (section) => {
    const { top } = section.getBoundingClientRect();
    return top >= 0 && top < innerHeight;
  };
  const lastPassed = () =>
    sections.findLast((section) => section.getBoundingClientRect().top < innerHeight / 3) ?? sections[0];

  // The last sections can't scroll up to the top, so at the bottom the one the user went to, or else the last, is current
  const currentSection = () => {
    if (!isAtBottom()) {
      return lastPassed();
    }
    const target = sections.find((section) => `#${section.id}` === location.hash);
    return target !== undefined && isInView(target) ? target : sections.at(-1);
  };

  const showCurrent = () => {
    const current = currentSection();
    for (const [id, link] of links) {
      link.ariaCurrent = id === current.id ? "location" : null;
    }
  };
  addEventListener("scroll", showCurrent, { passive: true });
  addEventListener("hashchange", showCurrent);
  showCurrent();
}
