export interface BrowserTab {
  navigate(url: string): void;
}

/**
 * The browser tabs connected to the server's event stream, in the order they connected
 */
export class BrowserTabs {
  private readonly tabs: BrowserTab[] = [];

  /**
   * @returns a function that disconnects the tab
   */
  public connect(tab: BrowserTab): () => void {
    this.tabs.push(tab);
    return () => {
      const index = this.tabs.indexOf(tab);
      if (index !== -1) {
        this.tabs.splice(index, 1);
      }
    };
  }

  /**
   * Shows a page in the most recently connected tab
   *
   * @param url the page to show
   * @returns false when no tab is connected
   */
  public navigateLatest(url: string): boolean {
    const latest = this.tabs.at(-1);
    latest?.navigate(url);
    return latest !== undefined;
  }
}
