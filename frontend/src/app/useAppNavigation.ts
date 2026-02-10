import React from "react";
import { usePaneLayout } from "../pane";
import type { NavigationState, PageName } from "../types";

export interface UseAppNavigationReturn {
	currentPage: PageName;
	navigationState: NavigationState;
	onNavigate: (page: PageName, state?: NavigationState) => void;
	showArchived: boolean;
	onToggleArchived: () => void;
	onRegisterToggleArchived: (handler: () => void) => void;
	onToggleSidebar: () => void;
	onRegisterToggleSidebar: (handler: () => void) => void;
}

/**
 * App-level navigation state and handlers. Owns current page, navigation state,
 * archive/sidebar toggle registration, and document layout restoration on navigate.
 * Used by GlobalCommandHotkey (palette + Router) so the hotkey component only
 * registers shortcuts and composes UI.
 */
export function useAppNavigation(): UseAppNavigationReturn {
	const { loadAndRestoreLayout } = usePaneLayout();
	const [currentPage, setCurrentPage] = React.useState<PageName>(() => {
		if (typeof window === "undefined") {
			return "dashboard";
		}
		const { page } = readNavigationFromUrl();
		return page;
	});
	const [navigationState, setNavigationState] = React.useState<NavigationState>(() => {
		if (typeof window === "undefined") {
			return {};
		}
		const { state } = readNavigationFromUrl();
		return state;
	});
	const [showArchived, setShowArchived] = React.useState(false);
	const toggleArchivedRef = React.useRef<(() => void) | null>(null);
	const toggleSidebarRef = React.useRef<(() => void) | null>(null);

	const onNavigate = React.useCallback(
		(page: PageName, state?: NavigationState) => {
			setCurrentPage(page);
			if (state) {
				setNavigationState(state);
			} else {
				setNavigationState({});
			}
			if (page === "document" && state?.documentPath) {
				const docPath = state.documentPath as string;
				loadAndRestoreLayout(docPath);
			}
			if (typeof window !== "undefined") {
				writeNavigationToUrl(page, state);
			}
		},
		[loadAndRestoreLayout],
	);

	const onRegisterToggleArchived = React.useCallback((handler: () => void) => {
		toggleArchivedRef.current = handler;
	}, []);

	const onToggleArchived = React.useCallback(() => {
		if (toggleArchivedRef.current) {
			toggleArchivedRef.current();
			setShowArchived((prev) => !prev);
		}
	}, []);

	const onRegisterToggleSidebar = React.useCallback((handler: () => void) => {
		toggleSidebarRef.current = handler;
	}, []);

	const onToggleSidebar = React.useCallback(() => {
		if (toggleSidebarRef.current) {
			toggleSidebarRef.current();
		}
	}, []);

	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const handlePopState = (event: PopStateEvent) => {
			// Prefer state from history when available; fall back to URL
			if (event.state && typeof event.state.page === "string") {
				const nextPage = event.state.page as PageName;
				const nextState: NavigationState = event.state.state ?? {};
				setCurrentPage(nextPage);
				setNavigationState(nextState);
				if (nextPage === "document" && nextState.documentPath) {
					const docPath = nextState.documentPath as string;
					loadAndRestoreLayout(docPath);
				}
				return;
			}

			const { page, state } = readNavigationFromUrl();
			setCurrentPage(page);
			setNavigationState(state);
			if (page === "document" && state.documentPath) {
				const docPath = state.documentPath as string;
				loadAndRestoreLayout(docPath);
			}
		};

		window.addEventListener("popstate", handlePopState);
		return () => {
			window.removeEventListener("popstate", handlePopState);
		};
	}, [loadAndRestoreLayout]);

	return {
		currentPage,
		navigationState,
		onNavigate,
		showArchived,
		onToggleArchived,
		onRegisterToggleArchived,
		onToggleSidebar,
		onRegisterToggleSidebar,
	};
}

function readNavigationFromUrl(): { page: PageName; state: NavigationState } {
	if (typeof window === "undefined") {
		return { page: "dashboard", state: {} };
	}

	try {
		const url = new URL(window.location.href);
		const searchParams = url.searchParams;
		const pageParam = (searchParams.get("page") as PageName | null) ?? "dashboard";

		const state: NavigationState = {};
		searchParams.forEach((value, key) => {
			if (key === "page") return;
			// Store everything as strings; callers can coerce as needed.
			state[key] = value;
		});

		return { page: pageParam, state };
	} catch {
		return { page: "dashboard", state: {} };
	}
}

function writeNavigationToUrl(page: PageName, state?: NavigationState): void {
	if (typeof window === "undefined" || typeof window.history === "undefined") {
		return;
	}

	try {
		const url = new URL(window.location.href);
		const searchParams = url.searchParams;

		// Reset all params then apply current navigation
		for (const key of Array.from(searchParams.keys())) {
			searchParams.delete(key);
		}
		searchParams.set("page", page);

		if (state) {
			for (const [key, value] of Object.entries(state)) {
				if (value === undefined) continue;
				searchParams.set(key, String(value));
			}
		}

		const nextUrl = `${url.pathname}?${searchParams.toString()}${url.hash}`;
		window.history.pushState({ page, state }, "", nextUrl);
	} catch {
		// Best-effort URL sync; ignore failures (e.g., invalid URL environment)
	}
}
