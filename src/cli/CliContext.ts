import type { CliTerminal } from "./CliTerminal";

export interface CliContext {
  /**
   * The built CLI's own path, which starts the server as `node <cliPath> serve`
   */
  cliPath: string;

  terminal: CliTerminal;
}
