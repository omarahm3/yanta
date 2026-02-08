import { Events } from "@wailsio/runtime";
import React from "react";
import { BackgroundQuit, ForceQuit } from "../../bindings/yanta/internal/system/service";
import { GlobalCommandPalette } from "../components";
import { useToast } from "../components/ui";
import { GLOBAL_SHORTCUTS } from "../config";
import { useDialog, useProjectContext, useUserProgressContext } from "../contexts";
import { useHelp, useHotkey } from "../hooks";
import { Router } from "./Router";
import { useAppNavigation } from "./useAppNavigation";

const HelpHotkey = () => {
	const { openHelp } = useHelp();

	useHotkey({
		...GLOBAL_SHORTCUTS.help,
		handler: openHelp,
		allowInInput: false,
	});

	return null;
};

const QuitHotkeys = () => {
	useHotkey({
		...GLOBAL_SHORTCUTS.quit,
		capture: true,
		handler: (e) => {
			e.preventDefault();
			BackgroundQuit();
		},
		allowInInput: true,
	});

	useHotkey({
		...GLOBAL_SHORTCUTS.forceQuit,
		capture: true,
		handler: (e) => {
			e.preventDefault();
			ForceQuit();
		},
		allowInInput: true,
	});

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

const WindowEventListener = () => {
	const toast = useToast();

	React.useEffect(() => {
		const unsubscribe = Events.On("yanta/window/hidden", () => {
			toast.info(
				"YANTA is running in background. Press Ctrl+Shift+Y anywhere to restore, or click the taskbar icon",
				{ duration: 5000 },
			);
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [toast]);

	return null;
};

const ProjectSwitchTracker = () => {
	const { currentProject } = useProjectContext();
	const { incrementProjectsSwitched } = useUserProgressContext();
	const previousProjectIdRef = React.useRef<string | undefined>(undefined);
	const isFirstRenderRef = React.useRef(true);

	React.useEffect(() => {
		const currentId = currentProject?.id;
		const previousId = previousProjectIdRef.current;

		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			previousProjectIdRef.current = currentId;
			return;
		}

		if (currentId && previousId && currentId !== previousId) {
			incrementProjectsSwitched();
		}

		previousProjectIdRef.current = currentId;
	}, [currentProject?.id, incrementProjectsSwitched]);

	return null;
};

export { HelpHotkey, QuitHotkeys, GlobalCommandHotkey, WindowEventListener, ProjectSwitchTracker };
