/**
 * A request the review server refused, with the stable reason it gave
 */
export class ReviewApiError extends Error {
  public readonly reason: string;
  public readonly status: number;

  public constructor(status: number, reason: string, message: string) {
    super(message);
    this.name = "ReviewApiError";
    this.reason = reason;
    this.status = status;
  }
}
