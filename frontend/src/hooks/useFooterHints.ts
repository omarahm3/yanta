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
 * Ctrl+K (Commands) is always priority 1 to ensure users can always access the command palette.
 * Navigation hints (↑↓, ←→) are typically priority 1 as they're essential for keyboard users.
 */
const HINT_CONFIGS: Record<PageContext, FooterHint[]> = {
	dashboard: [
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: "Enter", label: "Open", priority: 2 },
		{ key: "Ctrl+N", label: "New", priority: 2 },
		{ key: "Ctrl+K", label: "Commands", priority: 1 },
	],
	document: [
		{ key: "Ctrl+S", label: "Save", priority: 1 },
		{ key: "Ctrl+\\", label: "Split", priority: 3 },
		{ key: "Alt+X", label: "Close pane", priority: 3 },
		{ key: "Alt+H/J/K/L", label: "Focus panes", priority: 3 },
		{ key: "Esc", label: "Back", priority: 2 },
		{ key: "Ctrl+K", label: "Commands", priority: 1 },
	],
	journal: [
		{ key: "←→", label: "Change date", priority: 1 },
		{ key: "↑↓", label: "Navigate", priority: 2 },
		{ key: "Ctrl+T", label: "Today", priority: 2 },
		{ key: "Ctrl+K", label: "Commands", priority: 1 },
	],
	search: [
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: "Enter", label: "Open", priority: 2 },
		{ key: "Esc", label: "Clear", priority: 2 },
		{ key: "Ctrl+K", label: "Commands", priority: 1 },
	],
	settings: [
		{ key: "Esc", label: "Back", priority: 1 },
		{ key: "Ctrl+K", label: "Commands", priority: 1 },
	],
	projects: [
		{ key: "↑↓", label: "Navigate", priority: 1 },
		{ key: "Enter", label: "Open", priority: 2 },
		{ key: "Ctrl+K", label: "Commands", priority: 1 },
	],
	"quick-capture": [
		{ key: "Ctrl+Enter", label: "Save", priority: 1 },
		{ key: "Esc", label: "Cancel", priority: 2 },
		{ key: "Ctrl+K", label: "Commands", priority: 1 },
	],
	test: [{ key: "Ctrl+K", label: "Commands", priority: 1 }],
};

/**
 * Default hints shown when page context is unknown
 */
const DEFAULT_HINTS: FooterHint[] = [{ key: "Ctrl+K", label: "Commands", priority: 1 }];

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
