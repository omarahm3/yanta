import { AlertTriangle } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GranularErrorBoundary, Layout } from "@/app";
import { ENABLE_PLUGINS } from "@/config/featureFlags";
import {
	formatShortcutKeyForDisplay,
	getShortcutsForSettingsFromMerged,
	parseDisplayKeyToConfigKey,
} from "@/config/shortcuts";
import { useMergedConfig, usePreferencesOverrides } from "@/config/usePreferencesOverrides";
import { useNotification } from "@/shared/hooks";
import { type ThemeMode, useTheme } from "../shared/stores/theme.store";
import type { PageName } from "../shared/types";
import { Callout, ConfirmDialog, MigrationConflictDialog, type Shortcut } from "../shared/ui";
import { cn } from "../shared/utils/cn";
import { AboutSection } from "./AboutSection";
import { AppearanceSection } from "./AppearanceSection";
import { BackupSection } from "./BackupSection";
import { DatabaseSection } from "./DatabaseSection";
import { EditorSection } from "./EditorSection";
import { GeneralSection } from "./GeneralSection";
import { GitSyncSection } from "./GitSyncSection";
import { sectionMatchesQuery, useSettingsPage } from "./hooks/useSettingsPage";
import { LoggingSection } from "./LoggingSection";
import { McpSection } from "./McpSection";
import { PluginsSection } from "./PluginsSection";
import { SettingsNav } from "./SettingsNav";
import { ShortcutsSection } from "./ShortcutsSection";
import { useMcpSettings } from "./useMcpSettings";
import { usePluginSettings } from "./usePluginSettings";

interface SettingsProps {
	onNavigate?: (page: PageName) => void;
	onRegisterToggleSidebar?: (handler: () => void) => void;
}

const SettingsComponent: React.FC<SettingsProps> = ({ onNavigate, onRegisterToggleSidebar }) => {
	const { shortcuts: mergedShortcuts, graphics: mergedGraphics } = useMergedConfig();
	const { overrides, setOverrides, deleteShortcutOverride } = usePreferencesOverrides();
	const { error: notifyError } = useNotification();
	const pluginSettings = usePluginSettings(ENABLE_PLUGINS);
	const mcpSettings = useMcpSettings();
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

	// Build a flat map of shortcut overrides for the ShortcutsSection
	const shortcutOverrides = useMemo(() => {
		const map: Record<string, string> = {};
		if (!overrides?.shortcuts) return map;
		for (const [group, groupOverrides] of Object.entries(overrides.shortcuts)) {
			if (groupOverrides && typeof groupOverrides === "object") {
				for (const [key, value] of Object.entries(groupOverrides)) {
					map[`${group}.${key}`] = value as string;
				}
			}
		}
		return map;
	}, [overrides]);

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
		gitStatusError,
		refreshGitStatus,
		syncNow,
		generalRef,
		appearanceRef,
		editorRef,
		pluginsRef,
		databaseRef,
		shortcutsRef,
		loggingRef,
		backupRef,
		syncRef,
		mcpRef,
		aboutRef,
		settingsKey,
		setSettingsKey,
		sidebarSections,
		sections,
		activeSection,
		selectSection,
	} = useSettingsPage({ onNavigate, enablePluginsSection: ENABLE_PLUGINS });

	const [filter, setFilter] = useState("");
	const query = filter.trim().toLowerCase();
	const visibleSections = useMemo(
		() => (query === "" ? sections : sections.filter((s) => sectionMatchesQuery(s, query))),
		[sections, query],
	);
	const visibleIds = useMemo(
		() => new Set<string>(visibleSections.map((s) => s.id)),
		[visibleSections],
	);
	// If the filter hides the active section, fall back to the first match so the
	// pane always shows something that's still in the (filtered) nav.
	const activeVisibleSection = useMemo(
		() => (visibleIds.has(activeSection) ? activeSection : (visibleSections[0]?.id ?? activeSection)),
		[activeSection, visibleSections, visibleIds],
	);
	// Master-detail: only the active section renders (null when nothing matches).
	const shownSection = visibleSections.length > 0 ? activeVisibleSection : null;
	const isVisible = useCallback((id: string) => shownSection === id, [shownSection]);

	// Reset the pane to the top whenever the section changes.
	const scrollRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (scrollRef.current) scrollRef.current.scrollTop = 0;
	}, [shownSection]);

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
			try {
				await setOverrides({
					shortcuts: {
						[group]: { [key]: configKey },
					},
				});
			} catch (err) {
				notifyError(`Failed to save shortcut: ${err}`);
			}
		},
		[setOverrides, controller.platform, notifyError],
	);

	const handleShortcutReset = useCallback(
		async (id: string) => {
			const dot = id.indexOf(".");
			if (dot === -1) return;
			const group = id.slice(0, dot);
			const key = id.slice(dot + 1);
			try {
				await deleteShortcutOverride(group, key);
			} catch (err) {
				notifyError(`Failed to reset shortcut: ${err}`);
			}
		},
		[deleteShortcutOverride, notifyError],
	);

	const handleLinuxGraphicsModeChange = useCallback(
		async (mode: "auto" | "native" | "compat" | "software") => {
			try {
				await setOverrides({
					graphics: {
						linuxMode: mode,
					},
				});
			} catch (err) {
				notifyError(`Failed to save graphics mode: ${err}`);
			}
		},
		[setOverrides, notifyError],
	);

	const theme = useTheme();
	const handleThemeChange = useCallback(
		async (value: ThemeMode) => {
			try {
				await setOverrides({ appearance: { theme: value } });
			} catch (err) {
				notifyError(`Failed to save theme: ${err}`);
			}
		},
		[setOverrides, notifyError],
	);

	const handleEditorPrefsChange = useCallback(
		async (
			editorPrefs: Parameters<
				NonNullable<React.ComponentProps<typeof EditorSection>["onEditorPrefsChange"]>
			>[0],
		) => {
			try {
				await setOverrides({ editor: editorPrefs });
			} catch (err) {
				notifyError(`Failed to save editor settings: ${err}`);
			}
		},
		[setOverrides, notifyError],
	);

	const handleLaunchAtStartupToggle = useCallback(
		async (enabled: boolean) => {
			try {
				await setOverrides({ general: { launchAtStartup: enabled } });
			} catch (err) {
				notifyError(`Failed to save launch at startup setting: ${err}`);
			}
		},
		[setOverrides, notifyError],
	);

	return (
		<Layout
			sidebarSections={sidebarSections}
			currentPage="settings"
			headerShortcuts={[{ key: "?", label: "help" }]}
			onRegisterToggleSidebar={onRegisterToggleSidebar}
		>
			<div ref={scrollRef} className="h-full overflow-y-auto">
				<div className="mx-auto flex max-w-5xl gap-8 px-5 py-6">
					<SettingsNav
						className="sticky top-6 hidden self-start lg:block"
						sections={visibleSections}
						activeId={activeVisibleSection}
						onSelect={selectSection}
						filter={filter}
						onFilterChange={setFilter}
					/>
					<div className="min-w-0 flex-1">
						<h1 className="mb-6 text-2xl font-semibold text-text-bright">Settings</h1>

						{/* Narrow-width section switcher (the sidebar nav is desktop-only) */}
						<nav
							className="mb-6 flex gap-1 overflow-x-auto pb-1 lg:hidden"
							aria-label="Settings sections"
						>
							{visibleSections.map((s) => (
								<button
									key={s.id}
									type="button"
									onClick={() => selectSection(s.id)}
									aria-current={s.id === activeVisibleSection ? "true" : undefined}
									className={cn(
										"shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors",
										s.id === activeVisibleSection
											? "bg-accent/12 font-medium text-accent"
											: "text-text-dim hover:bg-accent/8 hover:text-text",
									)}
								>
									{s.label}
								</button>
							))}
						</nav>
						<GranularErrorBoundary
							key={settingsKey}
							message="Something went wrong in Settings."
							onRetry={() => setSettingsKey((k) => k + 1)}
						>
							{controller.needsRestart && (
								<Callout
									variant="warning"
									icon={<AlertTriangle className="h-5 w-5" />}
									title="Restart Required"
									className="mb-6"
								>
									Please restart the application for the log level changes to take effect.
								</Callout>
							)}

							{visibleSections.length === 0 && (
								<p className="text-sm text-text-dim">No settings match “{filter}”.</p>
							)}

							<div className={cn(!isVisible("general") && "hidden")}>
								<GeneralSection
									ref={generalRef}
									systemInfo={controller.systemInfo}
									keepInBackground={controller.keepInBackground}
									startHidden={controller.startHidden}
									linuxWindowMode={controller.linuxWindowMode}
									launchAtStartup={overrides?.general?.launchAtStartup ?? false}
									onKeepInBackgroundToggle={controller.handlers.handleKeepInBackgroundToggle}
									onStartHiddenToggle={controller.handlers.handleStartHiddenToggle}
									onLinuxWindowModeToggle={controller.handlers.handleLinuxWindowModeToggle}
									onLaunchAtStartupToggle={handleLaunchAtStartupToggle}
								/>
							</div>

							<div className={cn(!isVisible("appearance") && "hidden")}>
								<AppearanceSection
									ref={appearanceRef}
									platform={controller.platform}
									appScale={controller.appScale}
									onAppScaleChange={controller.handlers.handleAppScaleChange}
									theme={theme}
									onThemeChange={handleThemeChange}
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
							</div>

							<div className={cn(!isVisible("editor") && "hidden")}>
								<EditorSection
									ref={editorRef}
									editorPrefs={overrides?.editor ?? {}}
									onEditorPrefsChange={handleEditorPrefsChange}
								/>
							</div>

							{ENABLE_PLUGINS && (
								<div className={cn(!isVisible("plugins") && "hidden")}>
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
								</div>
							)}

							<div className={cn(!isVisible("database") && "hidden")}>
								<DatabaseSection
									ref={databaseRef}
									systemInfo={controller.systemInfo}
									isReindexing={controller.isReindexing}
									reindexProgress={controller.reindexProgress}
									onReindex={controller.handlers.handleRequestReindex}
								/>
							</div>

							<div className={cn(!isVisible("shortcuts") && "hidden")}>
								<ShortcutsSection
									ref={shortcutsRef}
									platform={controller.platform}
									hotkeyConfig={controller.hotkeyConfig}
									onHotkeyConfigChange={controller.handlers.handleHotkeyConfigChange}
									hotkeyError={controller.hotkeyError}
									shortcuts={shortcutsForSettings}
									shortcutOverrides={shortcutOverrides}
									onShortcutOverride={handleShortcutOverride}
									onShortcutReset={handleShortcutReset}
								/>
							</div>

							<div className={cn(!isVisible("logging") && "hidden")}>
								<LoggingSection
									ref={loggingRef}
									systemInfo={controller.systemInfo}
									logLevelOptions={controller.logLevelOptions}
									onLogLevelChange={controller.handlers.handleLogLevelChange}
								/>
							</div>

							<div className={cn(!isVisible("backup") && "hidden")}>
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
							</div>

							<div className={cn(!isVisible("sync") && "hidden")}>
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
									gitStatusError={gitStatusError}
									lastSync={controller.lastSync}
									onGitSyncToggle={controller.handlers.handleGitSyncToggle}
									onCommitIntervalChange={controller.handlers.handleCommitIntervalChange}
									onAutoPushToggle={controller.handlers.handleAutoPushToggle}
									onBranchChange={controller.handlers.handleBranchChange}
									onPickDirectory={controller.handlers.handlePickDirectory}
									onMigration={controller.handlers.handleMigration}
									onSyncNow={syncNow}
									syncNowInFlight={controller.syncNowInFlight}
									onRefreshStatus={refreshGitStatus}
								/>
							</div>

							<div className={cn(!isVisible("mcp") && "hidden")}>
								<McpSection
									ref={mcpRef}
									status={mcpSettings.status}
									busy={mcpSettings.busy}
									onSetEnabled={mcpSettings.setEnabled}
									onSetPort={mcpSettings.setPort}
									onRegenerateToken={mcpSettings.regenerateToken}
								/>
							</div>

							<div className={cn(!isVisible("about") && "hidden")}>
								<AboutSection ref={aboutRef} systemInfo={controller.systemInfo} />
							</div>
						</GranularErrorBoundary>
					</div>
				</div>
			</div>

			<ConfirmDialog
				isOpen={controller.showReindexConfirm}
				onCancel={controller.handlers.handleCancelReindex}
				onConfirm={controller.handlers.handleConfirmReindex}
				title="Rebuild Search Index?"
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
