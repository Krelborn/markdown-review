/**
 * @param failure what a request to the server rejected with
 * @returns a message to show the user
 */
export function describeFailure(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}
