import React from "react";
import {
	selectCanGoBack,
	selectCanGoForward,
	useNavHistoryStore,
} from "@/shared/stores/navHistory.store";
import { useSyncStore } from "@/shared/stores/sync.store";
import { usePaneLayout } from "../pane";
import type { NavigationState, PageName } from "../shared/types";
import { useNavGuard } from "./hooks/useNavGuard";

const LAST_NAV_KEY = "yanta:lastNavigation";

// Guard against corrupt/tampered/old-schema localStorage: an invalid page would
// otherwise become currentPage and get re-persisted on the next navigation.
const KNOWN_PAGES: ReadonlySet<string> = new Set<PageName>([
	"dashboard",
	"document",
	"projects",
	"settings",
	"search",
	"test",
	"quick-capture",
	"journal",
]);

interface PersistedNav {
	page: PageName;
	state?: NavigationState;
}

function readPersistedNav(): PersistedNav | null {
	try {
		if (typeof window === "undefined") return null;
		const raw = window.localStorage.getItem(LAST_NAV_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as PersistedNav;
		if (!parsed || !KNOWN_PAGES.has(parsed.page)) return null;
		return parsed;
	} catch {
		return null;
	}
}

function writePersistedNav(page: PageName, state?: NavigationState): void {
	try {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(LAST_NAV_KEY, JSON.stringify({ page, state }));
	} catch {
		// Best-effort persistence; ignore failures
	}
}

function hasExplicitUrlNav(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const url = new URL(window.location.href);
		return url.searchParams.has("page");
	} catch {
		return false;
	}
}

export interface UseAppNavigationReturn {
	currentPage: PageName;
	navigationState: NavigationState;
	onNavigate: (page: PageName, state?: NavigationState) => void;
	showArchived: boolean;
	onToggleArchived: () => void;
	onRegisterToggleArchived: (handler: () => void) => void;
	onToggleSidebar: () => void;
	onRegisterToggleSidebar: (handler: () => void) => void;
	goBack: () => void;
	goForward: () => void;
	canGoBack: boolean;
	canGoForward: boolean;
	showNavGuardDialog: boolean;
	confirmNavigation: () => void;
	cancelNavigation: () => void;
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
		if (hasExplicitUrlNav()) {
			const { page } = readNavigationFromUrl();
			return page;
		}
		const persisted = readPersistedNav();
		if (persisted) return persisted.page;
		const { page } = readNavigationFromUrl();
		return page;
	});
	const [navigationState, setNavigationState] = React.useState<NavigationState>(() => {
		if (typeof window === "undefined") {
			return {};
		}
		if (hasExplicitUrlNav()) {
			const { state } = readNavigationFromUrl();
			return state;
		}
		const persisted = readPersistedNav();
		if (persisted) return persisted.state ?? {};
		const { state } = readNavigationFromUrl();
		return state;
	});
	const [showArchived, setShowArchived] = React.useState(false);
	const toggleArchivedRef = React.useRef<(() => void) | null>(null);
	const toggleSidebarRef = React.useRef<(() => void) | null>(null);

	const onNavigateRaw = React.useCallback(
		(page: PageName, state?: NavigationState) => {
			setCurrentPage(page);
			if (state) {
				setNavigationState(state);
			} else {
				setNavigationState({});
			}
			writePersistedNav(page, state);
			if (page === "document" && state?.documentPath) {
				const docPath = state.documentPath as string;
				loadAndRestoreLayout(docPath);
			}
			if (typeof window !== "undefined") {
				const idx = useNavHistoryStore.getState().recordPush();
				writeNavigationToUrl(page, state, idx);
			}
		},
		[loadAndRestoreLayout],
	);

	const {
		guardedNavigate: onNavigate,
		showNavGuardDialog,
		confirmNavigation,
		cancelNavigation,
	} = useNavGuard(onNavigateRaw);

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

	// The native application menu (main.go) dispatches these window events; wire
	// them to the in-app navigation and sync actions so the Settings and Sync Now
	// menu items actually do something.
	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		const handleNavigate = (event: Event) => {
			const detail = (event as CustomEvent<{ page?: PageName }>).detail;
			if (detail?.page) {
				onNavigate(detail.page);
			}
		};
		const handleSyncNow = () => {
			void useSyncStore.getState().syncNow();
		};
		window.addEventListener("yanta:navigate", handleNavigate);
		window.addEventListener("yanta:sync-now", handleSyncNow);
		return () => {
			window.removeEventListener("yanta:navigate", handleNavigate);
			window.removeEventListener("yanta:sync-now", handleSyncNow);
		};
	}, [onNavigate]);

	const canGoBack = useNavHistoryStore(selectCanGoBack);
	const canGoForward = useNavHistoryStore(selectCanGoForward);

	// Guarded so we never step off the app's own history into a blank entry.
	const goBack = React.useCallback(() => {
		if (typeof window !== "undefined" && useNavHistoryStore.getState().index > 0) {
			window.history.back();
		}
	}, []);

	const goForward = React.useCallback(() => {
		const { index, maxIndex } = useNavHistoryStore.getState();
		if (typeof window !== "undefined" && index < maxIndex) {
			window.history.forward();
		}
	}, []);

	// Stamp the initial history entry with index 0 so back/forward from the first
	// screen is never into a blank entry.
	React.useEffect(() => {
		if (typeof window === "undefined" || typeof window.history === "undefined") {
			return;
		}
		const current = window.history.state;
		if (!current || typeof current.idx !== "number") {
			const { page, state } = readNavigationFromUrl();
			window.history.replaceState({ page, state, idx: 0 }, "");
		} else {
			// Reload mid-history: seed the store so back stays enabled.
			useNavHistoryStore.getState().hydrate(current.idx);
		}
	}, []);

	// Restore document layout on mount when the initial page is a document.
	React.useEffect(() => {
		if (currentPage === "document" && navigationState.documentPath) {
			loadAndRestoreLayout(navigationState.documentPath as string);
		}
	}, []);

	React.useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}

		const handlePopState = (event: PopStateEvent) => {
			useNavHistoryStore
				.getState()
				.recordPopTo(typeof event.state?.idx === "number" ? event.state.idx : 0);

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
		goBack,
		goForward,
		canGoBack,
		canGoForward,
		showNavGuardDialog,
		confirmNavigation,
		cancelNavigation,
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

function writeNavigationToUrl(page: PageName, state?: NavigationState, idx?: number): void {
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
		window.history.pushState({ page, state, idx }, "", nextUrl);
	} catch {
		// Best-effort URL sync; ignore failures (e.g., invalid URL environment)
	}
}
