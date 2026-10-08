/**
 * A request the review server refused or answered with something the CLI cannot read
 */
export class ServerRequestError extends Error {
  public readonly reason: string;
  public readonly status: number;

  public constructor(status: number, reason: string, message: string) {
    super(message);
    this.name = "ServerRequestError";
    this.reason = reason;
    this.status = status;
  }
}
