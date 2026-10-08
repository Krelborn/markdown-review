import { createContext } from "react";

/**
 * Text the user has typed into a comment box and not yet saved, by the box's key, kept while the boxes come and go
 */
export const UnsentTextContext = createContext<Map<string, string> | null>(null);
