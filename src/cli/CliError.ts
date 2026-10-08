/**
 * A command that cannot finish, with the `next_step` that tells the agent what to do about it
 */
export class CliError extends Error {
  public readonly exitCode: number;
  public readonly nextStep: string;

  public constructor(message: string, nextStep: string, exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.nextStep = nextStep;
  }
}
