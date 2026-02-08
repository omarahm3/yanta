import React from "react";
import { GlobalCommandPalette, MilestoneHintManager, WelcomeOverlay } from "../components";
import { HelpModal, ResizeHandles, TitleBar, ToastProvider } from "../components/ui";
import {
	DocumentCountProvider,
	DocumentProvider,
	HelpProvider,
	HotkeyProvider,
	ProjectProvider,
	UserProgressProvider,
} from "../contexts";
import { PaneLayoutProvider } from "../pane";
import {
	GlobalCommandHotkey,
	HelpHotkey,
	ProjectSwitchTracker,
	QuitHotkeys,
	WindowEventListener,
} from "./global-hotkeys";
import { ScaleStoreInit } from "./ScaleStoreInit";

/**
 * Composes all app-level providers and shell UI (titlebar, hotkeys, modals).
 * Used by App.tsx as the single root after CrashBoundary.
 */
export function AppProviders() {
	return (
		<ToastProvider>
			<>
				<ScaleStoreInit />
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
			</>
		</ToastProvider>
	);
}
