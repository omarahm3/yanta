import { useMemo } from "react";
import type { FooterHint } from "../components/ui/FooterHintBar";

/**
 * Page types that have specific footer hint configurations
 */
export type PageContext =
	| "dashboard"
	| "document"
	| "journal"
	| "search"
	| "settings"
	| "projects"
	| "quick-capture"
	| "test";

/**
 * Hint configurations for each page context.
 * Each configuration provides the most relevant keyboard shortcuts for that page.
 *
 * Priority levels:
 * - 1: Always shown (even on narrow viewports < 768px)
 * - 2: Hidden on narrow viewports (default)
 * - 3: Lowest priority, hidden on narrow viewports
 *
 * Navigation hints (↑↓, ←→) are typically priority 1 as they're essential for keyboard users.
 */
const HINT_CONFIGS: Record<PageContext, FooterHint[]> = {
	dashboard: [
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: "Enter", label: "Open", priority: 1 },
		{ key: "Space", label: "Select", priority: 1 },
		{ key: "Ctrl+N", label: "New", priority: 2 },
		{ key: "Ctrl+M", label: "Move", priority: 2 },
		{ key: "Ctrl+A", label: "Archive", priority: 2 },
		{ key: "Ctrl+U", label: "Restore", priority: 3 },
		{ key: "Ctrl+D", label: "Delete", priority: 3 },
		{ key: "Ctrl+Shift+D", label: "Permanent delete", priority: 3 },
		{ key: "Ctrl+E", label: "Export MD", priority: 3 },
		{ key: "Ctrl+Shift+E", label: "Export PDF", priority: 3 },
		{ key: "Ctrl+Shift+A", label: "Toggle archived", priority: 3 },
	],
	document: [
		{ key: "Ctrl+S", label: "Save", priority: 1 },
		{ key: "Esc", label: "Back", priority: 1 },
		{ key: "Enter", label: "Focus editor", priority: 2 },
		{ key: "Ctrl+E", label: "Export MD", priority: 2 },
		{ key: "Ctrl+Shift+E", label: "Export PDF", priority: 3 },
		{ key: "Ctrl+\\", label: "Split right", priority: 3 },
		{ key: "Ctrl+Shift+\\", label: "Split down", priority: 3 },
		{ key: "Alt+X", label: "Close pane", priority: 3 },
		{ key: "Alt+H/J/K/L", label: "Focus panes", priority: 3 },
	],
	journal: [
		{ key: "←→", label: "Change date", priority: 1 },
		{ key: "Ctrl+N/P", label: "Next/prev day", priority: 2 },
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: "Space", label: "Select", priority: 2 },
		{ key: "Ctrl+D", label: "Delete", priority: 2 },
		{ key: "Ctrl+Shift+P", label: "Promote", priority: 3 },
	],
	search: [
		{ key: "/", label: "Focus search", priority: 1 },
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: "Enter", label: "Open", priority: 1 },
		{ key: "Tab", label: "To results", priority: 2 },
		{ key: "Esc", label: "Clear", priority: 2 },
	],
	settings: [{ key: "j/k", label: "Navigate sections", priority: 1 }],
	projects: [
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: "Enter", label: "Open", priority: 1 },
		{ key: "Ctrl+N", label: "New", priority: 2 },
		{ key: "Ctrl+A", label: "Archive", priority: 2 },
		{ key: "Ctrl+U", label: "Restore", priority: 3 },
		{ key: "Ctrl+D", label: "Delete", priority: 3 },
		{ key: "Ctrl+Shift+D", label: "Permanent delete", priority: 3 },
	],
	"quick-capture": [
		{ key: "Ctrl+Enter", label: "Save", priority: 1 },
		{ key: "Shift+Enter", label: "Save & stay", priority: 2 },
		{ key: "Esc", label: "Cancel", priority: 2 },
	],
	test: [],
};

/**
 * Default hints shown when page context is unknown
 */
const DEFAULT_HINTS: FooterHint[] = [];

export interface UseFooterHintsOptions {
	/**
	 * The current page context/route
	 */
	currentPage: string;
}

export interface UseFooterHintsReturn {
	/**
	 * The hints to display for the current page context
	 */
	hints: FooterHint[];
}

/**
 * Hook that returns context-aware keyboard shortcut hints based on the current page.
 *
 * @param options - Options containing the current page context
 * @returns Object containing the hints array for the current page
 *
 * @example
 * ```tsx
 * const { hints } = useFooterHints({ currentPage: "dashboard" });
 * return <FooterHintBar hints={hints} />;
 * ```
 */
export function useFooterHints({ currentPage }: UseFooterHintsOptions): UseFooterHintsReturn {
	const hints = useMemo(() => {
		const pageKey = currentPage as PageContext;
		return HINT_CONFIGS[pageKey] ?? DEFAULT_HINTS;
	}, [currentPage]);

	return { hints };
}

/**
 * Get hints for a specific page context (non-hook version for testing/utilities)
 */
export function getHintsForPage(page: string): FooterHint[] {
	const pageKey = page as PageContext;
	return HINT_CONFIGS[pageKey] ?? DEFAULT_HINTS;
}
