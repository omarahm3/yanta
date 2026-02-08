import type React from "react";
import type { ReactNode } from "react";

export type { DocumentCountContextValue } from "../../shared/stores/documentCount.store";

/**
 * Document count state is now in shared/stores/documentCount.store (Zustand).
 * Re-export so existing imports keep working.
 */
export { useDocumentCount } from "../../shared/stores/documentCount.store";

/**
 * No-op for backward compatibility: tests may still wrap with DocumentCountProvider.
 */
export const DocumentCountProvider: React.FC<{ children: ReactNode }> = ({ children }) => children;
