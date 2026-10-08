export type StoreErrorReason =
  | "invalid-file"
  | "invalid-input"
  | "invalid-state"
  | "missing-document"
  | "unknown-thread";

/**
 * A store operation that cannot be carried out; `reason` says why
 */
export class StoreError extends Error {
  public readonly reason: StoreErrorReason;

  public constructor(reason: StoreErrorReason, message: string) {
    super(message);
    this.name = "StoreError";
    this.reason = reason;
  }
}
