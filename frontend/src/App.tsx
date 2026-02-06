import { Events } from "@wailsio/runtime";
import React from "react";
import { BackgroundQuit, ForceQuit } from "../bindings/yanta/internal/system/service";
import { GlobalCommandPalette, MilestoneHintManager, WelcomeOverlay } from "./components";
import { Router } from "./components/Router";
import { HelpModal, ResizeHandles, TitleBar, ToastProvider, useToast } from "./components/ui";
import {
	DialogProvider,
	DocumentCountProvider,
	DocumentProvider,
	HelpProvider,
	HotkeyProvider,
	PaneLayoutProvider,
	ProjectProvider,
	ScaleProvider,
	TitleBarProvider,
	UserProgressProvider,
	useDialog,
	useProjectContext,
	useUserProgressContext,
} from "./contexts";
import { useHotkey, usePaneLayout } from "./hooks";
import { useHelp } from "./hooks/useHelp";
import type { NavigationState, PageName } from "./types";

import "./styles/tailwind.css";
import "./styles/yanta.css";

const HelpHotkey = () => {
	const { openHelp } = useHelp();

	useHotkey({
		key: "shift+/",
		handler: openHelp,
		allowInInput: false,
		description: "Toggle help",
	});

	return null;
};

const QuitHotkeys = () => {
	useHotkey({
		key: "ctrl+q",
		capture: true,
		handler: (e) => {
			e.preventDefault();
			BackgroundQuit();
		},
		allowInInput: true,
		description: "Quit (background if enabled)",
	});

	useHotkey({
		key: "ctrl+shift+q",
		capture: true,
		handler: (e) => {
			e.preventDefault();
			ForceQuit();
		},
		allowInInput: true,
		description: "Force quit application",
	});

	return null;
};

const GlobalCommandHotkey = () => {
	const { openHelp } = useHelp();
	const { openDialog, closeDialog } = useDialog();
	const { loadAndRestoreLayout } = usePaneLayout();
	const [isOpen, setIsOpen] = React.useState(false);

	React.useEffect(() => {
		if (isOpen) openDialog();
		else closeDialog();
		return () => {
			if (isOpen) closeDialog();
		};
	}, [isOpen, openDialog, closeDialog]);
	const [currentPage, setCurrentPage] = React.useState<PageName>("dashboard");
	const [navigationState, setNavigationState] = React.useState<NavigationState>({});
	const [showArchived, setShowArchived] = React.useState(false);
	const toggleArchivedRef = React.useRef<(() => void) | null>(null);
	const toggleSidebarRef = React.useRef<(() => void) | null>(null);

	const handleNavigate = React.useCallback(
		(page: string, state?: NavigationState) => {
			setCurrentPage(page as PageName);
			setNavigationState(state || {});
			if (page === "document" && state?.documentPath) {
				const docPath = state.documentPath as string;
				loadAndRestoreLayout(docPath);
			}
		},
		[loadAndRestoreLayout],
	);

	const handleRegisterToggleArchived = React.useCallback((handler: () => void) => {
		toggleArchivedRef.current = handler;
	}, []);

	const handleToggleArchived = React.useCallback(() => {
		if (toggleArchivedRef.current) {
			toggleArchivedRef.current();
			setShowArchived((prev) => !prev);
		}
	}, []);

	const handleRegisterToggleSidebar = React.useCallback((handler: () => void) => {
		toggleSidebarRef.current = handler;
	}, []);

	const handleToggleSidebar = React.useCallback(() => {
		if (toggleSidebarRef.current) {
			toggleSidebarRef.current();
		}
	}, []);

	useHotkey({
		key: "mod+K",
		handler: () => setIsOpen(true),
		allowInInput: false,
		description: "Open command palette",
	});

	useHotkey({
		key: "mod+T",
		handler: (e) => {
			e.preventDefault();
			const today = new Date().toISOString().split("T")[0];
			handleNavigate("journal", { date: today });
		},
		allowInInput: false,
		description: "Jump to today's journal",
	});

	const { switchToLastProject, previousProject } = useProjectContext();

	useHotkey({
		key: "ctrl+Tab",
		handler: (e) => {
			e.preventDefault();
			if (previousProject) {
				switchToLastProject();
			}
		},
		allowInInput: true,
		description: "Switch to last project",
	});

	return (
		<>
			<GlobalCommandPalette
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onNavigate={handleNavigate}
				currentPage={currentPage}
				onToggleArchived={handleToggleArchived}
				showArchived={showArchived}
				onToggleSidebar={handleToggleSidebar}
				onShowHelp={openHelp}
			/>
			<Router
				currentPage={currentPage}
				navigationState={navigationState}
				onNavigate={handleNavigate}
				dashboardProps={{
					onRegisterToggleArchived: handleRegisterToggleArchived,
				}}
				onRegisterToggleSidebar={handleRegisterToggleSidebar}
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

		// Skip the first render (initial project load)
		if (isFirstRenderRef.current) {
			isFirstRenderRef.current = false;
			previousProjectIdRef.current = currentId;
			return;
		}

		// Track when project changes (not on initial load)
		if (currentId && previousId && currentId !== previousId) {
			incrementProjectsSwitched();
		}

		previousProjectIdRef.current = currentId;
	}, [currentProject?.id, incrementProjectsSwitched]);

	return null;
};

function App() {
	React.useEffect(() => {
		const handleError = (event: ErrorEvent) => {
			console.error("[App] Uncaught error:", {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				error: event.error,
			});
		};

		const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
			console.error("[App] Unhandled promise rejection:", {
				reason: event.reason,
				promise: event.promise,
			});
		};

		window.addEventListener("error", handleError);
		window.addEventListener("unhandledrejection", handleUnhandledRejection);

		console.log("[App] Global error handlers registered");

		return () => {
			window.removeEventListener("error", handleError);
			window.removeEventListener("unhandledrejection", handleUnhandledRejection);
		};
	}, []);

	return (
		<ToastProvider>
			<ScaleProvider>
				<TitleBarProvider>
					<DialogProvider>
						<HotkeyProvider>
							<HelpProvider>
								<ProjectProvider>
									<UserProgressProvider>
										<DocumentCountProvider>
											<DocumentProvider>
												<PaneLayoutProvider>
													<ResizeHandles />
													<TitleBar />
													<HelpHotkey />
													<QuitHotkeys />
													<GlobalCommandHotkey />
													<WindowEventListener />
													<ProjectSwitchTracker />
													<HelpModal />
													<WelcomeOverlay />
													<MilestoneHintManager />
												</PaneLayoutProvider>
											</DocumentProvider>
										</DocumentCountProvider>
									</UserProgressProvider>
								</ProjectProvider>
							</HelpProvider>
						</HotkeyProvider>
					</DialogProvider>
				</TitleBarProvider>
			</ScaleProvider>
		</ToastProvider>
	);
}

export default App;
