import { useEffect, useState } from "react";

/**
 * Follows whether the user holds ⌥, or Alt, down
 *
 * @returns true from when the key goes down until it comes up, the pointer moves without it, or the window loses focus
 */
export function useIsAltKeyDown(): boolean {
  const [isAltKeyDown, setIsAltKeyDown] = useState(false);
  useEffect(() => {
    const follow = ({ altKey }: KeyboardEvent | MouseEvent): void => setIsAltKeyDown(altKey);
    const release = (): void => setIsAltKeyDown(false);
    window.addEventListener("keydown", follow);
    window.addEventListener("keyup", follow);
    window.addEventListener("mousemove", follow);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("keydown", follow);
      window.removeEventListener("keyup", follow);
      window.removeEventListener("mousemove", follow);
      window.removeEventListener("blur", release);
    };
  }, []);
  return isAltKeyDown;
}
