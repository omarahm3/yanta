import React from "react";
import { GranularErrorBoundary } from "@/app";
import { Layout } from "../components/Layout";
import { ConfirmDialog, MigrationConflictDialog, type Shortcut } from "../components/ui";
import {
	formatShortcutKeyForDisplay,
	getShortcutsForSettings,
} from "../config";
import { AboutSection } from "./AboutSection";
import { AppearanceSection } from "./AppearanceSection";
import { BackupSection } from "./BackupSection";
import { DatabaseSection } from "./DatabaseSection";
import { GeneralSection } from "./GeneralSection";
import { GitSyncSection } from "./GitSyncSection";
import { LoggingSection } from "./LoggingSection";
import { ShortcutsSection } from "./ShortcutsSection";
import { useSettingsPage } from "./hooks/useSettingsPage";
import type { PageName } from "../types";

/** Shortcuts from config/shortcuts (single source of truth for registration + display). */
const SHORTCUTS_FOR_SETTINGS: Shortcut[] = getShortcutsForSettings().map(({ id, action, key }) => ({
	id,
	action,
	defaultKey: formatShortcutKeyForDisplay(key),
	currentKey: formatShortcutKeyForDisplay(key),
	editable: false,
}));

interface SettingsProps {
	onNavigate?: (page: PageName) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const SettingsComponent: React.FC<SettingsProps> = ({ onNavigate, onRegisterToggleSidebar }) => {
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
		gitStatus,
		gitStatusLoading,
		refreshGitStatus,
		generalRef,
		appearanceRef,
		databaseRef,
		shortcutsRef,
		loggingRef,
		backupRef,
		syncRef,
		aboutRef,
		settingsKey,
		setSettingsKey,
		sidebarSections,
	} = useSettingsPage({ onNavigate });

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
							appScale={controller.appScale}
							onAppScaleChange={controller.handlers.handleAppScaleChange}
							sidebarVisible={sidebarVisible}
							onSidebarVisibleChange={setSidebarVisible}
							sidebarLoading={sidebarLoading}
							showFooterHints={showFooterHints}
							onShowFooterHintsChange={setShowFooterHints}
							footerHintsLoading={footerHintsLoading}
							showShortcutTooltips={showShortcutTooltips}
							onShowShortcutTooltipsChange={setShowShortcutTooltips}
							shortcutTooltipsLoading={shortcutTooltipsLoading}
						/>

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
							shortcuts={SHORTCUTS_FOR_SETTINGS}
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
