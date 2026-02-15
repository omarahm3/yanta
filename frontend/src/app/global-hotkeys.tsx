import { GlobalCommandPalette, useCommandPaletteStore } from "../command-palette";
import { GLOBAL_SHORTCUTS } from "@/config/public";
import { useHelp } from "../help";
import { useHotkey } from "../hotkeys";
import { useProjectContext } from "../project";
import { useAppGlobalEffects } from "./hooks";
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

	useHotkey({
		...GLOBAL_SHORTCUTS.commandPalette,
		handler: () => openCommandPalette(),
		allowInInput: false,
	});

	useHotkey({
		...GLOBAL_SHORTCUTS.today,
		handler: (e) => {
			e.preventDefault();
			const today = new Date().toISOString().split("T")[0];
			nav.onNavigate("journal", { date: today });
		},
		allowInInput: false,
	});

	const { switchToLastProject, previousProject } = useProjectContext();

	useHotkey({
		...GLOBAL_SHORTCUTS.switchProject,
		handler: (e) => {
			e.preventDefault();
			if (previousProject) {
				switchToLastProject();
			}
		},
		allowInInput: true,
	});

	return (
		<>
			<GlobalCommandPalette
				onClose={() => closeCommandPalette()}
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
		</>
	);
};

export { AppGlobalEffects, GlobalCommandHotkey };

