/**
 * Serialises asynchronous operations so they run one at a time in call order
 */
export class OperationQueue {
  private queue: Promise<void> = Promise.resolve();

  /**
   * Runs a task after all previous tasks in this queue have settled
   *
   * @param task the asynchronous operation to run
   * @returns a promise that resolves to the task's result
   */
  public enqueue<Result>(task: () => Promise<Result>): Promise<Result> {
    const result = this.queue.then(task);
    this.queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
