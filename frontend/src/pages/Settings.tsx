import React, { useCallback, useRef } from "react";
import { Layout } from "../components/Layout";
import { ConfirmDialog, MigrationConflictDialog, type Shortcut } from "../components/ui";
import {
	formatShortcutKeyForDisplay,
	getShortcutsForSettings,
	SETTINGS_SHORTCUTS,
} from "../config";
import {
	useFooterHintsSetting,
	useGitStatus,
	useHotkeys,
	useShortcutTooltipsSetting,
	useSidebarSetting,
} from "../hooks";
import { useHelp } from "../hooks/useHelp";
import { useSidebarSections } from "../hooks/useSidebarSections";
import { AboutSection } from "./settings/AboutSection";
import { AppearanceSection } from "./settings/AppearanceSection";
import { BackupSection } from "./settings/BackupSection";
import { DatabaseSection } from "./settings/DatabaseSection";
import { GeneralSection } from "./settings/GeneralSection";
import { GitSyncSection } from "./settings/GitSyncSection";
import { LoggingSection } from "./settings/LoggingSection";
import { ShortcutsSection } from "./settings/ShortcutsSection";
import { useSettingsController } from "./settings/useSettingsController";

/** Shortcuts from config/shortcuts (single source of truth for registration + display). */
const shortcutsFromConfig = (): Shortcut[] =>
	getShortcutsForSettings().map(({ id, action, key }) => ({
		id,
		action,
		defaultKey: formatShortcutKeyForDisplay(key),
		currentKey: formatShortcutKeyForDisplay(key),
		editable: false,
	}));

/** Shortcuts not yet in config (command-line, search UI, etc.). Shown in Settings until moved to config. */
const shortcutsNotInConfig: Shortcut[] = [
	{ id: "command-line", action: "Focus command line", defaultKey: ":", currentKey: ":", editable: false },
	{ id: "escape", action: "Exit command line", defaultKey: "Esc", currentKey: "Esc", editable: false },
	{ id: "delete-block", action: "Delete block (Document page)", defaultKey: "Ctrl+D", currentKey: "Ctrl+D", editable: false },
	{
		id: "toggle-archived-projects",
		action: "Toggle show archived (Projects page)",
		defaultKey: "Ctrl+Shift+A",
		currentKey: "Ctrl+Shift+A",
		editable: false,
	},
	{ id: "search-focus", action: "Focus search input (Search page)", defaultKey: "/", currentKey: "/", editable: false },
	{ id: "search-to-results", action: "Move to results (Search page)", defaultKey: "Tab", currentKey: "Tab", editable: false },
	{ id: "search-next", action: "Navigate down results (Search page)", defaultKey: "j", currentKey: "j", editable: false },
	{ id: "search-prev", action: "Navigate up results (Search page)", defaultKey: "k", currentKey: "k", editable: false },
	{ id: "search-open", action: "Open selected result (Search page)", defaultKey: "Enter", currentKey: "Enter", editable: false },
	{ id: "search-unfocus", action: "Unfocus search input (Search page)", defaultKey: "Esc", currentKey: "Esc", editable: false },
];

const actualShortcuts: Shortcut[] = [...shortcutsFromConfig(), ...shortcutsNotInConfig];

interface SettingsProps {
	onNavigate?: (page: string) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate, onRegisterToggleSidebar }) => {
	const controller = useSettingsController();
	const { setPageContext } = useHelp();
	const { sidebarVisible, setSidebarVisible, isLoading: sidebarLoading } = useSidebarSetting();
	const {
		showFooterHints,
		setShowFooterHints,
		isLoading: footerHintsLoading,
	} = useFooterHintsSetting();
	const {
		showShortcutTooltips,
		setShowShortcutTooltips,
		isLoading: shortcutTooltipsLoading,
	} = useShortcutTooltipsSetting();
	const {
		status: gitStatus,
		isLoading: gitStatusLoading,
		refresh: refreshGitStatus,
	} = useGitStatus(controller.gitSync.enabled ? 30000 : 0);

	const generalRef = useRef<HTMLDivElement>(null);
	const appearanceRef = useRef<HTMLDivElement>(null);
	const databaseRef = useRef<HTMLDivElement>(null);
	const shortcutsRef = useRef<HTMLDivElement>(null);
	const loggingRef = useRef<HTMLDivElement>(null);
	const backupRef = useRef<HTMLDivElement>(null);
	const syncRef = useRef<HTMLDivElement>(null);
	const aboutRef = useRef<HTMLDivElement>(null);

	const [currentSectionIndex, setCurrentSectionIndex] = React.useState(0);

	const sectionIds = [
		"general",
		"appearance",
		"database",
		"shortcuts",
		"logging",
		"backup",
		"sync",
		"about",
	];

	React.useEffect(() => {
		setPageContext([], "Settings");
	}, [setPageContext]);

	const scrollToSection = useCallback((sectionId: string) => {
		const refMap: Record<string, React.RefObject<HTMLDivElement>> = {
			general: generalRef,
			appearance: appearanceRef,
			database: databaseRef,
			shortcuts: shortcutsRef,
			logging: loggingRef,
			backup: backupRef,
			sync: syncRef,
			about: aboutRef,
		};

		const ref = refMap[sectionId];
		if (ref?.current) {
			ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
		}

		const index = sectionIds.indexOf(sectionId);
		if (index !== -1) {
			setCurrentSectionIndex(index);
		}
	}, []);

	const handleNextSection = useCallback(() => {
		const nextIndex = Math.min(currentSectionIndex + 1, sectionIds.length - 1);
		setCurrentSectionIndex(nextIndex);
		scrollToSection(sectionIds[nextIndex]);
	}, [currentSectionIndex, scrollToSection]);

	const handlePreviousSection = useCallback(() => {
		const prevIndex = Math.max(currentSectionIndex - 1, 0);
		setCurrentSectionIndex(prevIndex);
		scrollToSection(sectionIds[prevIndex]);
	}, [currentSectionIndex, scrollToSection]);

	const hotkeys = React.useMemo(
		() => [
			{ ...SETTINGS_SHORTCUTS.navNext, handler: handleNextSection, allowInInput: false },
			{ ...SETTINGS_SHORTCUTS.navPrev, handler: handlePreviousSection, allowInInput: false },
		],
		[handleNextSection, handlePreviousSection],
	);

	useHotkeys(hotkeys);

	const settingsItems = [
		{
			id: "general",
			label: "general",
			onClick: () => scrollToSection("general"),
		},
		{
			id: "appearance",
			label: "appearance",
			onClick: () => scrollToSection("appearance"),
		},
		{
			id: "database",
			label: "database",
			onClick: () => scrollToSection("database"),
		},
		{
			id: "shortcuts",
			label: "shortcuts",
			onClick: () => scrollToSection("shortcuts"),
		},
		{
			id: "logging",
			label: "logging",
			onClick: () => scrollToSection("logging"),
		},
		{
			id: "backup",
			label: "backup",
			onClick: () => scrollToSection("backup"),
		},
		{
			id: "sync",
			label: "sync",
			onClick: () => scrollToSection("sync"),
		},
		{
			id: "about",
			label: "about",
			onClick: () => scrollToSection("about"),
		},
	];

	const sidebarSections = useSidebarSections({
		currentPage: "settings",
		onNavigate,
		additionalSections: [
			{
				id: "settings",
				title: "SETTINGS",
				items: settingsItems,
			},
		],
	});

	return (
		<Layout
			sidebarSections={sidebarSections}
			currentPage="settings"
			headerShortcuts={[{ key: "?", label: "help" }]}
			onRegisterToggleSidebar={onRegisterToggleSidebar}
		>
			<div className="h-full p-5 overflow-y-auto">
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
						shortcuts={actualShortcuts}
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
