const recentLimit = 10;

/**
 * The docs most recently opened by the agent or shown in a browser, newest first
 */
export class RecentDocuments {
  private documents: string[] = [];

  public add(document: string): void {
    this.documents = [document, ...this.documents.filter((existing) => existing !== document)].slice(0, recentLimit);
  }

  public list(): string[] {
    return [...this.documents];
  }
}
