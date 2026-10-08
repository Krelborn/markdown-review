export interface ReviewState {
  requestedAt: string | null;
  approvedAt: string | null;

  /**
   * True when the user approved after the agent last opened the review, so the current round is over
   */
  approved: boolean;
}
