import React, { useCallback, useMemo } from "react";
import { GranularErrorBoundary, Layout } from "@/app";
import { ENABLE_PLUGINS } from "@/config/featureFlags";
import {
	formatShortcutKeyForDisplay,
	getShortcutsForSettingsFromMerged,
	parseDisplayKeyToConfigKey,
} from "@/config/shortcuts";
import { useMergedConfig, usePreferencesOverrides } from "@/config/usePreferencesOverrides";
import type { PageName } from "../shared/types";
import { ConfirmDialog, MigrationConflictDialog, type Shortcut } from "../shared/ui";
import { AboutSection } from "./AboutSection";
import { AppearanceSection } from "./AppearanceSection";
import { BackupSection } from "./BackupSection";
import { DatabaseSection } from "./DatabaseSection";
import { GeneralSection } from "./GeneralSection";
import { GitSyncSection } from "./GitSyncSection";
import { useSettingsPage } from "./hooks/useSettingsPage";
import { LoggingSection } from "./LoggingSection";
import { PluginsSection } from "./PluginsSection";
import { ShortcutsSection } from "./ShortcutsSection";
import { usePluginSettings } from "./usePluginSettings";

interface SettingsProps {
	onNavigate?: (page: PageName) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const SettingsComponent: React.FC<SettingsProps> = ({ onNavigate, onRegisterToggleSidebar }) => {
	const { shortcuts: mergedShortcuts, graphics: mergedGraphics } = useMergedConfig();
	const { setOverrides } = usePreferencesOverrides();
	const pluginSettings = usePluginSettings(ENABLE_PLUGINS);
	const shortcutsForSettings: Shortcut[] = useMemo(
		() =>
			getShortcutsForSettingsFromMerged(mergedShortcuts).map(({ id, action, key }) => ({
				id,
				action,
				defaultKey: formatShortcutKeyForDisplay(key),
				currentKey: formatShortcutKeyForDisplay(key),
				editable: false,
			})),
		[mergedShortcuts],
	);

	const {
		controller,
		sidebarVisible,
		setSidebarVisible,
		sidebarLoading,
		showFooterHints,
		setShowFooterHints,
		footerHintsLoading,
		showShortcutTooltips,
		setShowShortcutTooltips,
		shortcutTooltipsLoading,
		tooltipHintsFeatureEnabled,
		gitStatus,
		gitStatusLoading,
		refreshGitStatus,
		generalRef,
		appearanceRef,
		pluginsRef,
		databaseRef,
		shortcutsRef,
		loggingRef,
		backupRef,
		syncRef,
		aboutRef,
		settingsKey,
		setSettingsKey,
		sidebarSections,
	} = useSettingsPage({ onNavigate, enablePluginsSection: ENABLE_PLUGINS });

	const handleShortcutOverride = useCallback(
		async (id: string, displayKey: string) => {
			const dot = id.indexOf(".");
			if (dot === -1) return;
			const group = id.slice(0, dot) as
				| "global"
				| "sidebar"
				| "document"
				| "dashboard"
				| "journal"
				| "projects"
				| "quickCapture"
				| "settings"
				| "commandLine"
				| "search"
				| "pane";
			const key = id.slice(dot + 1);
			const configKey = parseDisplayKeyToConfigKey(displayKey, controller.platform);
			await setOverrides({
				shortcuts: {
					[group]: { [key]: configKey },
				},
			});
		},
		[setOverrides, controller.platform],
	);

	const handleLinuxGraphicsModeChange = useCallback(
		async (mode: "auto" | "native" | "compat" | "software") => {
			await setOverrides({
				graphics: {
					linuxMode: mode,
				},
			});
		},
		[setOverrides],
	);

	return (
		<Layout
			sidebarSections={sidebarSections}
			currentPage="settings"
			headerShortcuts={[{ key: "?", label: "help" }]}
			onRegisterToggleSidebar={onRegisterToggleSidebar}
		>
			<div className="h-full p-5 overflow-y-auto">
				<GranularErrorBoundary
					key={settingsKey}
					message="Something went wrong in Settings."
					onRetry={() => setSettingsKey((k) => k + 1)}
				>
					<div className="max-w-4xl mx-auto">
						{controller.needsRestart && (
							<div className="p-4 mb-6 border border-yellow-700 rounded bg-yellow-900/30">
								<div className="mb-1 font-medium text-yellow-400">Restart Required</div>
								<div className="text-sm text-yellow-300">
									Please restart the application for the log level changes to take effect.
								</div>
							</div>
						)}

						<GeneralSection
							ref={generalRef}
							systemInfo={controller.systemInfo}
							keepInBackground={controller.keepInBackground}
							startHidden={controller.startHidden}
							linuxWindowMode={controller.linuxWindowMode}
							onKeepInBackgroundToggle={controller.handlers.handleKeepInBackgroundToggle}
							onStartHiddenToggle={controller.handlers.handleStartHiddenToggle}
							onLinuxWindowModeToggle={controller.handlers.handleLinuxWindowModeToggle}
						/>

						<AppearanceSection
							ref={appearanceRef}
							platform={controller.platform}
							appScale={controller.appScale}
							onAppScaleChange={controller.handlers.handleAppScaleChange}
							linuxGraphicsMode={mergedGraphics.linuxMode}
							onLinuxGraphicsModeChange={handleLinuxGraphicsModeChange}
							sidebarVisible={sidebarVisible}
							onSidebarVisibleChange={setSidebarVisible}
							sidebarLoading={sidebarLoading}
							showFooterHints={showFooterHints}
							onShowFooterHintsChange={setShowFooterHints}
							footerHintsLoading={footerHintsLoading}
							showShortcutTooltips={showShortcutTooltips}
							onShowShortcutTooltipsChange={setShowShortcutTooltips}
							shortcutTooltipsLoading={shortcutTooltipsLoading}
							tooltipHintsFeatureEnabled={tooltipHintsFeatureEnabled}
						/>

						{ENABLE_PLUGINS && (
							<PluginsSection
								ref={pluginsRef}
								plugins={pluginSettings.plugins}
								isLoading={pluginSettings.isLoading}
								errorMessage={pluginSettings.errorMessage}
								pluginDirectory={pluginSettings.pluginDirectory}
								communityPluginsEnabled={pluginSettings.communityPluginsEnabled}
								onReload={pluginSettings.reload}
								onInstall={pluginSettings.installPlugin}
								onToggleEnabled={pluginSettings.setPluginEnabled}
								onUninstall={pluginSettings.uninstallPlugin}
								onCommunityPluginsEnabledChange={pluginSettings.setCommunityPluginsEnabled}
							/>
						)}

						<DatabaseSection
							ref={databaseRef}
							systemInfo={controller.systemInfo}
							isReindexing={controller.isReindexing}
							reindexProgress={controller.reindexProgress}
							onReindex={controller.handlers.handleRequestReindex}
						/>

						<ShortcutsSection
							ref={shortcutsRef}
							platform={controller.platform}
							hotkeyConfig={controller.hotkeyConfig}
							onHotkeyConfigChange={controller.handlers.handleHotkeyConfigChange}
							hotkeyError={controller.hotkeyError}
							shortcuts={shortcutsForSettings}
							onShortcutOverride={handleShortcutOverride}
						/>

						<LoggingSection
							ref={loggingRef}
							systemInfo={controller.systemInfo}
							logLevelOptions={controller.logLevelOptions}
							onLogLevelChange={controller.handlers.handleLogLevelChange}
						/>

						<BackupSection
							ref={backupRef}
							backupEnabled={controller.backupConfig.Enabled}
							maxBackups={controller.backupConfig.MaxBackups}
							backups={controller.backups}
							onBackupToggle={controller.handlers.handleBackupToggle}
							onMaxBackupsChange={controller.handlers.handleMaxBackupsChange}
							onRestore={controller.handlers.handleRestoreBackup}
							onDelete={controller.handlers.handleDeleteBackup}
						/>

						<GitSyncSection
							ref={syncRef}
							gitInstalled={controller.gitInstalled}
							currentDataDir={controller.currentDataDir}
							migrationTarget={controller.migrationTarget}
							setMigrationTarget={controller.setMigrationTarget}
							isMigrating={controller.isMigrating}
							migrationProgress={controller.migrationProgress}
							dataDirOverridden={controller.dataDirOverridden}
							dataDirEnvVar={controller.dataDirEnvVar}
							gitSyncEnabled={controller.gitSync.enabled}
							commitInterval={controller.gitSync.commitInterval}
							autoPush={controller.gitSync.autoPush}
							branch={controller.gitSync.branch}
							branches={controller.gitBranches}
							currentBranch={controller.currentGitBranch}
							commitIntervalOptions={controller.commitIntervalOptions}
							gitStatus={gitStatus}
							gitStatusLoading={gitStatusLoading}
							onGitSyncToggle={controller.handlers.handleGitSyncToggle}
							onCommitIntervalChange={controller.handlers.handleCommitIntervalChange}
							onAutoPushToggle={controller.handlers.handleAutoPushToggle}
							onBranchChange={controller.handlers.handleBranchChange}
							onPickDirectory={controller.handlers.handlePickDirectory}
							onMigration={controller.handlers.handleMigration}
							onSyncNow={controller.handlers.handleSyncNow}
							syncNowInFlight={controller.syncNowInFlight}
							onRefreshStatus={refreshGitStatus}
						/>

						<AboutSection ref={aboutRef} systemInfo={controller.systemInfo} />
					</div>
				</GranularErrorBoundary>
			</div>

			<ConfirmDialog
				isOpen={controller.showReindexConfirm}
				onCancel={controller.handlers.handleCancelReindex}
				onConfirm={controller.handlers.handleConfirmReindex}
				title="Reindex Database?"
				message="This will rebuild the entire search index from your JSON files. The operation may take a few moments depending on the number of documents."
				confirmText="Reindex"
				cancelText="Cancel"
			/>

			<MigrationConflictDialog
				isOpen={controller.showConflictDialog}
				conflictInfo={controller.conflictInfo}
				onCancel={controller.handlers.handleConflictCancel}
				onConfirm={controller.handlers.handleConflictConfirm}
				isLoading={controller.isMigrating}
			/>
		</Layout>
	);
};

export const Settings = React.memo(SettingsComponent);
