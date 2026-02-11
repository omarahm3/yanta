import { MilestoneHintManager, WelcomeOverlay } from "../components";
import { HelpModal, ResizeHandles, TitleBar, ToastProvider } from "../components/ui";
import { DocumentProvider, HelpProvider, HotkeyProvider } from "../contexts";
import { PaneLayoutProvider } from "../pane";
import { ReducedEffectsInit } from "../shared/stores/appearance.store";
import { DocumentCountStoreInit } from "./DocumentCountStoreInit";
import { AppGlobalEffects, GlobalCommandHotkey } from "./global-hotkeys";
import { ProjectStoreInit } from "./ProjectStoreInit";
import { ScaleStoreInit } from "./ScaleStoreInit";

export function AppProviders() {
	return (
		<ToastProvider>
			<ReducedEffectsInit />
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
