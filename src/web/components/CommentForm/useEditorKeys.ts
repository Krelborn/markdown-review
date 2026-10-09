import type { RefObject } from "react";
import { useEffect } from "react";

/**
 * Lets the user save the editor with Cmd+Enter or Ctrl+Enter, and answer Escape, from anywhere inside it
 *
 * @param formRef the editor's form
 * @param escape what Escape does
 */
export function useEditorKeys(formRef: RefObject<HTMLFormElement | null>, escape: () => void): void {
  useEffect(() => {
    const form = formRef.current;
    if (form === null) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        escape();
      } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        form.requestSubmit();
      }
    };
    form.addEventListener("keydown", onKeyDown);
    return () => form.removeEventListener("keydown", onKeyDown);
  }, [escape, formRef]);
}
