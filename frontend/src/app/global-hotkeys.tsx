import { useCallback, useEffect } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { todayLocalString } from "@/shared/utils/date";
import { GlobalCommandPalette, useCommandPaletteStore } from "../command-palette";
import { GlobalSearch, useGlobalSearchStore } from "../global-search";
import { useHelp } from "../help";
import { useHotkey } from "../hotkeys";
import { useProjectContext } from "../project";
import { ProjectSwitcher, useProjectSwitcherStore } from "../project-switcher";
import { useNotification } from "../shared/hooks";
import { useSyncStore } from "../shared/stores/sync.store";
import { SyncToast } from "../shared/ui";
import { useAppGlobalEffects } from "./hooks";
import { useLeaderKeys } from "./hooks/useLeaderKeys";
import { NavGuardDialog } from "./hooks/useNavGuard";
import { useOpenJournalFromCapture } from "./hooks/useOpenJournalFromCapture";
import { Router } from "./Router";
import { useAppNavigation } from "./useAppNavigation";

const AppGlobalEffects = () => {
	useAppGlobalEffects();
	return null;
};

const GlobalCommandHotkey = () => {
	const { openHelp } = useHelp();
	const nav = useAppNavigation();
	const openCommandPalette = useCommandPaletteStore((s) => s.open);
	const closeCommandPalette = useCommandPaletteStore((s) => s.close);
	const handleCloseCommandPalette = useCallback(() => {
		closeCommandPalette();
	}, [closeCommandPalette]);
	const { shortcuts } = useMergedConfig();
	const global = shortcuts.global;

	useLeaderKeys({ onNavigate: nav.onNavigate });

	useHotkey({
		...global.commandPalette,
		handler: (e) => {
			e.preventDefault();
			openCommandPalette();
		},
		allowInInput: true,
		capture: true,
	});

	useHotkey({
		...global.today,
		handler: (e) => {
			e.preventDefault();
			nav.onNavigate("journal", { date: todayLocalString() });
		},
		allowInInput: true,
		capture: true,
	});

	const { switchToLastProject, previousProject, projects, setCurrentProject } = useProjectContext();
	const { info } = useNotification();
	const openProjectSwitcher = useProjectSwitcherStore((s) => s.open);
	const openGlobalSearch = useGlobalSearchStore((s) => s.open);

	// Route the Quick Capture window's "Open" action to the entry's journal.
	useOpenJournalFromCapture({ onNavigate: nav.onNavigate, projects, setCurrentProject });

	useHotkey({
		...global.switchProject,
		handler: (e) => {
			e.preventDefault();
			if (previousProject) {
				switchToLastProject();
			} else {
				info("No previous project to switch to");
			}
		},
		allowInInput: true,
	});

	useHotkey({
		...global.projectSwitcher,
		handler: (e) => {
			e.preventDefault();
			openProjectSwitcher();
		},
		allowInInput: true,
		capture: true,
	});

	useHotkey({
		...global.globalSearch,
		handler: (e) => {
			e.preventDefault();
			openGlobalSearch();
		},
		allowInInput: true,
		capture: true,
	});

	useHotkey({
		...shortcuts.quickCapture.default,
		handler: (e) => {
			e.preventDefault();
			nav.onNavigate("quick-capture");
		},
		allowInInput: false,
	});

	useHotkey({
		...global.navBack,
		handler: (e) => {
			e.preventDefault();
			nav.goBack();
		},
		allowInInput: false,
	});

	useHotkey({
		...global.navForward,
		handler: (e) => {
			e.preventDefault();
			nav.goForward();
		},
		allowInInput: false,
	});

	useHotkey({
		...global.gitSync,
		handler: (e) => {
			e.preventDefault();
			// syncNow() re-throws after recording lastError; swallow here so a
			// shortcut-triggered failure doesn't become an unhandled rejection.
			void useSyncStore
				.getState()
				.syncNow()
				.catch(() => {});
		},
		allowInInput: true,
	});

	// Mouse buttons 3/4 (back/forward on multi-button mice).
	useEffect(() => {
		const handleMouseUp = (e: MouseEvent) => {
			if (e.button === 3) {
				e.preventDefault();
				nav.goBack();
			} else if (e.button === 4) {
				e.preventDefault();
				nav.goForward();
			}
		};
		window.addEventListener("mouseup", handleMouseUp);
		return () => window.removeEventListener("mouseup", handleMouseUp);
	}, [nav.goBack, nav.goForward]);

	return (
		<>
			<ProjectSwitcher />
			<GlobalSearch onNavigate={nav.onNavigate} />
			<GlobalCommandPalette
				onClose={handleCloseCommandPalette}
				onNavigate={nav.onNavigate}
				currentPage={nav.currentPage}
				onToggleArchived={nav.onToggleArchived}
				showArchived={nav.showArchived}
				onToggleSidebar={nav.onToggleSidebar}
				onShowHelp={openHelp}
			/>
			<SyncToast />
			<Router
				currentPage={nav.currentPage}
				navigationState={nav.navigationState}
				onNavigate={nav.onNavigate}
				onRegisterToggleArchived={nav.onRegisterToggleArchived}
				onRegisterToggleSidebar={nav.onRegisterToggleSidebar}
			/>
			<NavGuardDialog
				isOpen={nav.showNavGuardDialog}
				onConfirm={nav.confirmNavigation}
				onCancel={nav.cancelNavigation}
			/>
		</>
	);
};

export { AppGlobalEffects, GlobalCommandHotkey };
