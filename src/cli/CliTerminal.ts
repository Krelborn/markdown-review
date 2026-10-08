/**
 * Where a command reads from and writes to, so commands can run outside a real process
 */
export interface CliTerminal {
  workingDirectory: string;
  env: Partial<Record<string, string>>;
  readStdin(): Promise<string>;
  stderr(text: string): void;
  stdout(text: string): void;
}
