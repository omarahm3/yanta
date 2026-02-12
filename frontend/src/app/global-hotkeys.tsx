import React from "react";
import { GlobalCommandPalette } from "../command-palette";
import { GLOBAL_SHORTCUTS } from "../config";
import { useHelp } from "../help";
import { useHotkey } from "../hotkeys";
import { useProjectContext } from "../project";
import { useDialog } from "./context";
import { useAppGlobalEffects } from "./hooks";
import { Router } from "./Router";
import { useAppNavigation } from "./useAppNavigation";

const AppGlobalEffects = () => {
	useAppGlobalEffects();
	return null;
};

const GlobalCommandHotkey = () => {
	const { openHelp } = useHelp();
	const { openDialog, closeDialog } = useDialog();
	const nav = useAppNavigation();
	const [isOpen, setIsOpen] = React.useState(false);

	React.useEffect(() => {
		if (isOpen) openDialog();
		else closeDialog();
		return () => {
			if (isOpen) closeDialog();
		};
	}, [isOpen, openDialog, closeDialog]);

	useHotkey({
		...GLOBAL_SHORTCUTS.commandPalette,
		handler: () => setIsOpen(true),
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
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
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
