import type React from "react";
import type { ReactNode } from "react";

export type { UserProgressData, UseUserProgressReturn } from "../../shared/stores/progress.store";

/**
 * User progress state is now in shared/stores/progress.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export { useUserProgressContext } from "../../shared/stores/progress.store";

/**
 * No-op for backward compatibility: tests and main.tsx may still wrap with UserProgressProvider.
 */
export const UserProgressProvider: React.FC<{ children: ReactNode }> = ({ children }) => children;
