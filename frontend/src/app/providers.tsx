import { DocumentProvider } from "../document";
import { HelpModal, HelpProvider } from "../help";
import { HotkeyProvider } from "../hotkeys";
import { MilestoneHintManager, WelcomeOverlay } from "../onboarding";
import { PaneLayoutProvider } from "../pane";
import { PluginBootstrap } from "../plugins";
import { ReducedEffectsInit } from "../shared/stores/appearance.store";
import { ToastProvider } from "../shared/ui";
import { ResizeHandles, TitleBar } from "./components";
import { AppMonitorInit } from "./AppMonitorInit";
import { DocumentCountStoreInit } from "./DocumentCountStoreInit";
import { FeatureFlagsStoreInit } from "./FeatureFlagsStoreInit";
import { AppGlobalEffects, GlobalCommandHotkey } from "./global-hotkeys";
import { PreferencesStoreInit } from "./PreferencesStoreInit";
import { ProjectStoreInit } from "./ProjectStoreInit";
import { ScaleStoreInit } from "./ScaleStoreInit";

export function AppProviders() {
	return (
		<ToastProvider>
			<ReducedEffectsInit />
			<ScaleStoreInit />
			<FeatureFlagsStoreInit />
			<AppMonitorInit />
			<DocumentCountStoreInit />
			<PreferencesStoreInit />
			<PluginBootstrap />
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
