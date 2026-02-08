import type React from "react";
import type { ReactNode } from "react";

export type { UseDialogReturn } from "../shared/stores/dialog.store";

/**
 * Dialog state is now in shared/stores/dialog.store (Zustand).
 * Re-export useDialog so existing imports keep working.
 */
export { useDialog } from "../shared/stores/dialog.store";

/**
 * No-op for backward compatibility: tests and main.tsx may still wrap with DialogProvider.
 * The store is global; this component no longer provides state.
 */
export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => children;
