import React from "react";
import { GlobalCommandPalette, MilestoneHintManager, WelcomeOverlay } from "../components";
import { HelpModal, ResizeHandles, TitleBar, ToastProvider } from "../components/ui";
import {
	DocumentProvider,
	HelpProvider,
	HotkeyProvider,
	ProjectProvider,
	UserProgressProvider,
} from "../contexts";
import { PaneLayoutProvider } from "../pane";
import { DocumentCountStoreInit } from "./DocumentCountStoreInit";
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
				<DocumentCountStoreInit />
				<HotkeyProvider>
					<HelpProvider>
						<ProjectProvider>
							<UserProgressProvider>
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
							</UserProgressProvider>
						</ProjectProvider>
					</HelpProvider>
				</HotkeyProvider>
			</>
		</ToastProvider>
	);
}
