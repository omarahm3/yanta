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
	general: { label: "General", keywords: "window background startup hidden linux" },
	appearance: {
		label: "Appearance",
		keywords: "theme dark light density scale sidebar hints tooltips effects glass",
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

export interface SettingsSectionEntry {
	id: SettingsSectionId;
	label: string;
	keywords: string;
}

export interface UseSettingsPageProps {
	onNavigate?: (page: PageName) => void;
	enablePluginsSection?: boolean;
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
