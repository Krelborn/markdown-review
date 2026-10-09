import { useEffect } from "react";

/**
 * Has the browser warn the user before they close or reload the page
 *
 * @param shouldWarn whether to warn, such as while the user has text they have not saved
 */
export function useLeavePageWarning(shouldWarn: boolean): void {
  useEffect(() => {
    if (!shouldWarn) {
      return;
    }
    const warn = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [shouldWarn]);
}
