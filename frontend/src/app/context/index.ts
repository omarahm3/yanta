import type React from "react";
import type { ReactNode } from "react";

export type { UseDialogReturn } from "../../shared/stores/dialog.store";
export { useDialog } from "../../shared/stores/dialog.store";

/**
 * No-op for backward compatibility: tests may still wrap with DialogProvider.
 * The store is global; this component no longer provides state.
 */
export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => children;

export { useScale } from "../../shared/stores/scale.store";

export type { TitleBarContextType } from "../stores/titlebar.store";
export { useTitleBarContext } from "../stores/titlebar.store";

/**
 * No-op for backward compatibility: tests may still wrap with TitleBarProvider.
 */
export const TitleBarProvider: React.FC<{ children: ReactNode }> = ({ children }) => children;
