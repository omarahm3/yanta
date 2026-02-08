import React from "react";
import { GlobalCommandPalette, MilestoneHintManager, WelcomeOverlay } from "../components";
import {
	DocumentCountProvider,
	DocumentProvider,
	HelpProvider,
	HotkeyProvider,
	ProjectProvider,
	TitleBarProvider,
	UserProgressProvider,
} from "../contexts";
import { PaneLayoutProvider } from "../pane";
import {
	HelpHotkey,
	QuitHotkeys,
	GlobalCommandHotkey,
	WindowEventListener,
	ProjectSwitchTracker,
} from "./global-hotkeys";
import { HelpModal, ResizeHandles, TitleBar, ToastProvider } from "../components/ui";
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
				<TitleBarProvider>
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
				</TitleBarProvider>
			</>
		</ToastProvider>
	);
}
