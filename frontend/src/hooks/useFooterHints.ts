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
 */
const HINT_CONFIGS: Record<PageContext, FooterHint[]> = {
	dashboard: [
		{ key: "↑↓", label: "Navigate" },
		{ key: "Enter", label: "Open" },
		{ key: "Ctrl+N", label: "New" },
		{ key: "Ctrl+K", label: "Commands" },
	],
	document: [
		{ key: "Ctrl+S", label: "Save" },
		{ key: "Esc", label: "Back" },
		{ key: "Ctrl+K", label: "Commands" },
	],
	journal: [
		{ key: "←→", label: "Change date" },
		{ key: "↑↓", label: "Navigate" },
		{ key: "Ctrl+T", label: "Today" },
		{ key: "Ctrl+K", label: "Commands" },
	],
	search: [
		{ key: "↑↓", label: "Navigate" },
		{ key: "Enter", label: "Open" },
		{ key: "Esc", label: "Clear" },
		{ key: "Ctrl+K", label: "Commands" },
	],
	settings: [
		{ key: "Esc", label: "Back" },
		{ key: "Ctrl+K", label: "Commands" },
	],
	projects: [
		{ key: "↑↓", label: "Navigate" },
		{ key: "Enter", label: "Open" },
		{ key: "Ctrl+K", label: "Commands" },
	],
	"quick-capture": [
		{ key: "Ctrl+Enter", label: "Save" },
		{ key: "Esc", label: "Cancel" },
		{ key: "Ctrl+K", label: "Commands" },
	],
	test: [
		{ key: "Ctrl+K", label: "Commands" },
	],
};

/**
 * Default hints shown when page context is unknown
 */
const DEFAULT_HINTS: FooterHint[] = [
	{ key: "Ctrl+K", label: "Commands" },
];

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
