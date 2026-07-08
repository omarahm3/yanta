import { useCallback, useEffect } from "react";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { GlobalCommandPalette, useCommandPaletteStore } from "../command-palette";
import { GlobalSearch, useGlobalSearchStore } from "../global-search";
import { useHelp } from "../help";
import { useHotkey } from "../hotkeys";
import { useProjectContext } from "../project";
import { ProjectSwitcher, useProjectSwitcherStore } from "../project-switcher";
import { useAppGlobalEffects } from "./hooks";
import { useLeaderKeys } from "./hooks/useLeaderKeys";
import { NavGuardDialog } from "./hooks/useNavGuard";
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
		handler: () => openCommandPalette(),
		allowInInput: false,
	});

	useHotkey({
		...global.today,
		handler: (e) => {
			e.preventDefault();
			const today = new Date().toISOString().split("T")[0];
			nav.onNavigate("journal", { date: today });
		},
		allowInInput: false,
	});

	const { switchToLastProject, previousProject } = useProjectContext();
	const openProjectSwitcher = useProjectSwitcherStore((s) => s.open);
	const openGlobalSearch = useGlobalSearchStore((s) => s.open);

	useHotkey({
		...global.switchProject,
		handler: (e) => {
			e.preventDefault();
			if (previousProject) {
				switchToLastProject();
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
		allowInInput: false,
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
