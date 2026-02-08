import type React from "react";
import type { ReactNode } from "react";

export type { TitleBarContextType } from "../app/stores/titlebar.store";

/**
 * TitleBar state is now in app/stores/titlebar.store (Zustand).
 * Re-export so existing imports from contexts keep working.
 */
export { useTitleBarContext } from "../app/stores/titlebar.store";

/**
 * No-op for backward compatibility: tests may still wrap with TitleBarProvider.
 */
export const TitleBarProvider: React.FC<{ children: ReactNode }> = ({ children }) => children;
