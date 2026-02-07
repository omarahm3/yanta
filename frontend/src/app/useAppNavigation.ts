import React from "react";
import { usePaneLayout } from "../pane";
import type { NavigationState, PageName } from "../types";

export interface UseAppNavigationReturn {
	currentPage: PageName;
	navigationState: NavigationState;
	onNavigate: (page: string, state?: NavigationState) => void;
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
	const [currentPage, setCurrentPage] = React.useState<PageName>("dashboard");
	const [navigationState, setNavigationState] = React.useState<NavigationState>({});
	const [showArchived, setShowArchived] = React.useState(false);
	const toggleArchivedRef = React.useRef<(() => void) | null>(null);
	const toggleSidebarRef = React.useRef<(() => void) | null>(null);

	const onNavigate = React.useCallback(
		(page: string, state?: NavigationState) => {
			setCurrentPage(page as PageName);
			if (state) {
				setNavigationState(state);
			}
			if (page === "document" && state?.documentPath) {
				const docPath = state.documentPath as string;
				loadAndRestoreLayout(docPath);
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
