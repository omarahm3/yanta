import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SETTINGS_SHORTCUTS } from "@/config/shortcuts";
import { useHelp } from "../../help";
import { useHotkeys } from "../../hotkeys";
import {
	useFeatureFlag,
	useFooterHintsSetting,
	useGitStatus,
	useShortcutTooltipsSetting,
	useSidebarSections,
	useSidebarSetting,
} from "../../shared/hooks";
import type { PageName } from "../../shared/types";
import { useSettingsController } from "../useSettingsController";

const BASE_SECTION_IDS = [
	"general",
	"appearance",
	"editor",
	"database",
	"shortcuts",
	"logging",
	"backup",
	"sync",
	"mcp",
	"about",
] as const;
type SettingsSectionId = (typeof BASE_SECTION_IDS)[number] | "plugins";

/** Display label + filter keywords for each section's TOC entry. */
const SECTION_META: Record<SettingsSectionId, { label: string; keywords: string }> = {
	general: {
		label: "General",
		keywords: "window background startup hidden linux mac autostart launch",
	},
	appearance: {
		label: "Appearance",
		keywords: "theme dark light density scale sidebar hints tooltips effects glass",
	},
	editor: {
		label: "Editor",
		keywords: "font size family line width spellcheck text editing",
	},
	plugins: { label: "Plugins", keywords: "community install extensions" },
	database: { label: "Storage", keywords: "storage database reindex search index data" },
	shortcuts: { label: "Keyboard Shortcuts", keywords: "hotkeys keys quick capture override" },
	logging: { label: "Diagnostics", keywords: "diagnostics log level debug verbose troubleshooting" },
	backup: { label: "Backup", keywords: "snapshot restore" },
	sync: { label: "Git Sync", keywords: "git commit push branch migrate data directory" },
	mcp: {
		label: "MCP Server",
		keywords: "mcp model context protocol agent claude codex opencode integration api",
	},
	about: { label: "About", keywords: "version system info" },
};

/** Searchable row metadata for each section. Used to index individual controls. */
const SECTION_ROWS: Record<SettingsSectionId, { title: string; description: string }[]> = {
	general: [
		{ title: "Keep running in background", description: "closing window hides instead of quitting" },
		{ title: "Start hidden", description: "launch minimized to background" },
		{ title: "Frameless window", description: "remove window borders title bar linux" },
		{ title: "Launch at startup", description: "autostart login boot mac windows" },
	],
	appearance: [
		{ title: "Theme", description: "dark light system mode" },
		{ title: "Show Sidebar", description: "navigation sidebar toggle" },
		{ title: "Show Keyboard Hints", description: "footer context shortcuts" },
		{ title: "Show Shortcut Tooltips", description: "hover tooltips buttons" },
		{ title: "Reduce Visual Effects", description: "disable glass blur performance" },
		{ title: "Density", description: "comfortable compact spacing" },
		{ title: "Interface Scale", description: "zoom text size percentage" },
		{ title: "Linux Graphics Mode", description: "gpu rendering compatibility" },
	],
	editor: [
		{ title: "Font Size", description: "text size pixels" },
		{ title: "Font Family", description: "typeface serif sans monospace" },
		{ title: "Line Width", description: "max width reading comfortable" },
		{ title: "Spellcheck", description: "spelling grammar browser" },
	],
	plugins: [
		{ title: "Plugin Directory", description: "install path folder" },
		{ title: "Community Plugins", description: "enable third-party extensions" },
	],
	database: [
		{ title: "Documents", description: "count entries" },
		{ title: "Projects", description: "count" },
		{ title: "Storage", description: "used space size" },
		{ title: "Rebuild Search Index", description: "reindex recreate json" },
	],
	shortcuts: [
		{ title: "Quick Capture Hotkey", description: "global system-wide background" },
		{ title: "Restore Window", description: "show focus hidden" },
		{ title: "Override Shortcuts", description: "customize rebind keys" },
		{ title: "Application Shortcuts", description: "reference table all" },
	],
	logging: [{ title: "Log Level", description: "debug info warn error verbosity" }],
	backup: [
		{ title: "Enable Backup", description: "automatic snapshot" },
		{ title: "Max Backups", description: "retention count limit" },
		{ title: "Restore Backup", description: "recover snapshot" },
		{ title: "Delete Backup", description: "remove snapshot" },
	],
	sync: [
		{ title: "Git Sync", description: "enable automatic commit" },
		{ title: "Commit Interval", description: "frequency minutes auto" },
		{ title: "Auto Push", description: "push remote automatic" },
		{ title: "Branch", description: "git branch name" },
		{ title: "Data Directory", description: "override path location" },
		{ title: "Migrate Data", description: "move directory git" },
		{ title: "Sync Now", description: "manual trigger immediate" },
	],
	mcp: [
		{ title: "Enable MCP Server", description: "start stop model context protocol" },
		{ title: "Port", description: "network port number" },
		{ title: "Regenerate Token", description: "api key authentication" },
	],
	about: [
		{ title: "Version", description: "build number" },
		{ title: "Reset Onboarding", description: "welcome screen tutorial" },
		{ title: "Reset Hints", description: "milestone tooltips" },
	],
};

export interface SettingsSectionEntry {
	id: SettingsSectionId;
	label: string;
	keywords: string;
}

export interface UseSettingsPageProps {
	onNavigate?: (page: PageName) => void;
	enablePluginsSection?: boolean;
}

/** Check if a section matches a search query (including row content). */
export function sectionMatchesQuery(section: SettingsSectionEntry, query: string): boolean {
	const q = query.toLowerCase();
	if (section.label.toLowerCase().includes(q)) return true;
	if (section.keywords.includes(q)) return true;
	const rows = SECTION_ROWS[section.id as SettingsSectionId];
	if (rows) {
		for (const row of rows) {
			if (row.title.toLowerCase().includes(q)) return true;
			if (row.description.toLowerCase().includes(q)) return true;
		}
	}
	return false;
}

export function useSettingsPage({
	onNavigate,
	enablePluginsSection = false,
}: UseSettingsPageProps) {
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
	const { enabled: tooltipHintsFeatureEnabled } = useFeatureFlag("tooltipHints");
	const {
		status: gitStatus,
		isLoading: gitStatusLoading,
		error: gitStatusError,
		refresh: refreshGitStatus,
	} = useGitStatus(controller.gitSync.enabled ? 30000 : 0);

	// Sync, then immediately refresh the displayed status so the panel reflects
	// the result without waiting for the 30s poll.
	const syncNow = useCallback(async () => {
		await controller.handlers.handleSyncNow();
		await refreshGitStatus();
	}, [controller.handlers.handleSyncNow, refreshGitStatus]);

	const generalRef = useRef<HTMLDivElement>(null);
	const appearanceRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<HTMLDivElement>(null);
	const pluginsRef = useRef<HTMLDivElement>(null);
	const databaseRef = useRef<HTMLDivElement>(null);
	const shortcutsRef = useRef<HTMLDivElement>(null);
	const loggingRef = useRef<HTMLDivElement>(null);
	const backupRef = useRef<HTMLDivElement>(null);
	const syncRef = useRef<HTMLDivElement>(null);
	const mcpRef = useRef<HTMLDivElement>(null);
	const aboutRef = useRef<HTMLDivElement>(null);

	const [settingsKey, setSettingsKey] = useState(0);
	const sectionIds = useMemo<SettingsSectionId[]>(
		() =>
			enablePluginsSection
				? [
						"general",
						"appearance",
						"editor",
						"plugins",
						"database",
						"shortcuts",
						"logging",
						"backup",
						"sync",
						"mcp",
						"about",
					]
				: [...BASE_SECTION_IDS],
		[enablePluginsSection],
	);

	useEffect(() => {
		setPageContext([], "Settings");
	}, [setPageContext]);

	// Master-detail: the active section is chosen from the nav (not scroll
	// position), and only that section renders.
	const [activeSection, setActiveSection] = useState<SettingsSectionId>(sectionIds[0]);
	const selectSection = useCallback(
		(sectionId: string) => {
			if (sectionIds.includes(sectionId as SettingsSectionId)) {
				setActiveSection(sectionId as SettingsSectionId);
			}
		},
		[sectionIds],
	);

	const sections = useMemo<SettingsSectionEntry[]>(
		() =>
			sectionIds.map((id) => ({
				id,
				label: SECTION_META[id].label,
				keywords: SECTION_META[id].keywords,
			})),
		[sectionIds],
	);

	const handleNextSection = useCallback(() => {
		const idx = sectionIds.indexOf(activeSection);
		setActiveSection(sectionIds[Math.min(idx + 1, sectionIds.length - 1)]);
	}, [activeSection, sectionIds]);

	const handlePreviousSection = useCallback(() => {
		const idx = sectionIds.indexOf(activeSection);
		setActiveSection(sectionIds[Math.max(idx - 1, 0)]);
	}, [activeSection, sectionIds]);

	const hotkeys = useMemo(
		() => [
			{ ...SETTINGS_SHORTCUTS.navNext, handler: handleNextSection, allowInInput: false },
			{ ...SETTINGS_SHORTCUTS.navPrev, handler: handlePreviousSection, allowInInput: false },
		],
		[handleNextSection, handlePreviousSection],
	);

	useHotkeys(hotkeys);

	// The icon rail renders only the global navigation destinations. Per-section
	// jumping lives in the in-page SettingsNav (TOC), not the rail.
	const sidebarSections = useSidebarSections({
		currentPage: "settings",
		onNavigate,
	});

	return {
		controller,
		// Sidebar / UI preferences
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
		// Git status
		gitStatus,
		gitStatusLoading,
		gitStatusError,
		refreshGitStatus,
		syncNow,
		// Section refs and navigation
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
		// Error boundary retry
		settingsKey,
		setSettingsKey,
		sidebarSections,
		// In-page section navigation (TOC)
		sections,
		activeSection,
		selectSection,
	};
}
