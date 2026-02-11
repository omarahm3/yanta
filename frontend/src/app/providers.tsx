import { MilestoneHintManager, WelcomeOverlay } from "../components";
import { HelpModal, ResizeHandles, TitleBar, ToastProvider } from "../components/ui";
import { DocumentProvider, HelpProvider, HotkeyProvider } from "../contexts";
import { PaneLayoutProvider } from "../pane";
import { DocumentCountStoreInit } from "./DocumentCountStoreInit";
import { AppGlobalEffects, GlobalCommandHotkey } from "./global-hotkeys";
import { ProjectStoreInit } from "./ProjectStoreInit";
import { ScaleStoreInit } from "./ScaleStoreInit";

export function AppProviders() {
	return (
		<ToastProvider>
			<ScaleStoreInit />
			<DocumentCountStoreInit />
			<ProjectStoreInit />
			<HotkeyProvider>
				<HelpProvider>
					<DocumentProvider>
						<PaneLayoutProvider>
							<ResizeHandles />
							<TitleBar />
							<AppGlobalEffects />
							<GlobalCommandHotkey />
							<HelpModal />
							<WelcomeOverlay />
							<MilestoneHintManager />
						</PaneLayoutProvider>
					</DocumentProvider>
				</HelpProvider>
			</HotkeyProvider>
		</ToastProvider>
	);
}
