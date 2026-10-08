/**
 * A latch that holds an operation at a point a test chooses until the test opens it
 */
export interface Gate {
  /**
   * Lets every current and future waiter through
   */
  open(): void;

  /**
   * Resolves once the gate has been opened
   */
  wait(): Promise<void>;
}

/**
 * Creates a closed gate
 *
 * @returns the gate
 */
export function createGate(): Gate {
  let open = (): void => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, wait: () => opened };
}
