import type { BrowserTabs } from "../events/BrowserTabs";
import type { ServerEvents } from "../events/ServerEvents";
import type { Logger } from "../logging/Logger";
import type { ActivityMonitor } from "../runtime/ActivityMonitor";
import type { ReviewStore } from "../store/ReviewStore";
import type { InstallKind } from "../update/installCommands";
import type { UpdateChecker } from "../update/UpdateChecker";

import type { RecentDocuments } from "./RecentDocuments";

export interface AppDependencies {
  activity: ActivityMonitor;
  events: ServerEvents;

  /**
   * How the running markdown-review was installed, which decides the update command
   */
  installKind: InstallKind;

  logger: Logger;

  /**
   * How often a waiting poll writes a space to keep its connection alive
   */
  pollKeepAliveMilliseconds: number;

  /**
   * The port the server listens on
   */
  port: () => number;

  recentDocuments: RecentDocuments;
  root: string;
  shutdown: () => void;
  store: ReviewStore;
  tabs: BrowserTabs;

  /**
   * What checks npm for a newer markdown-review, or null when the environment opts out
   */
  updateChecker: UpdateChecker | null;

  /**
   * The secret agent routes require, from `server.json`
   */
  token: string;

  version: string;

  /**
   * Starts watching a doc for edits, so connected tabs hear about them
   */
  watchDocument: (document: string) => void;

  /**
   * The built web app: `index.html` and its `assets/` directory
   */
  webDirectory: string;
}
