import { ENABLE_PLUGINS } from "../config/featureFlags";
import { DocumentProvider } from "../document";
import { HelpModal, HelpProvider } from "../help";
import { HotkeyProvider } from "../hotkeys";
import { MilestoneHintManager, WelcomeOverlay } from "../onboarding";
import { PaneLayoutProvider } from "../pane";
import { PluginBootstrap } from "../plugins";
import { ReducedEffectsInit } from "../shared/stores/appearance.store";
import { ThemeInit } from "../shared/stores/theme.store";
import { ToastProvider } from "../shared/ui";
import { AppMonitorInit } from "./AppMonitorInit";
import { ResizeHandles, TitleBar, UpdateBanner } from "./components";
import { DocumentCountStoreInit } from "./DocumentCountStoreInit";
import { FeatureFlagsStoreInit } from "./FeatureFlagsStoreInit";
import { AppGlobalEffects, GlobalCommandHotkey } from "./global-hotkeys";
import { PreferencesStoreInit } from "./PreferencesStoreInit";
import { ProjectStoreInit } from "./ProjectStoreInit";
import { ScaleStoreInit } from "./ScaleStoreInit";

export function AppProviders() {
	return (
		<ToastProvider>
			<ThemeInit />
			<ReducedEffectsInit />
			<ScaleStoreInit />
			<FeatureFlagsStoreInit />
			<AppMonitorInit />
			<DocumentCountStoreInit />
			<PreferencesStoreInit />
			{ENABLE_PLUGINS && <PluginBootstrap />}
			<ProjectStoreInit />
			<HotkeyProvider>
				<HelpProvider>
					<DocumentProvider>
						<PaneLayoutProvider>
							<ResizeHandles />
							<TitleBar />
							<UpdateBanner />
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
