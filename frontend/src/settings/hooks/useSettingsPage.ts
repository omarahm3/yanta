import type React from "react";
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
	database: { label: "Database", keywords: "reindex search index" },
	shortcuts: { label: "Keyboard Shortcuts", keywords: "hotkeys keys quick capture override" },
	logging: { label: "Logging", keywords: "log level debug verbose" },
	backup: { label: "Backup", keywords: "snapshot restore" },
	sync: { label: "Git Sync", keywords: "git commit push branch migrate data directory" },
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
		refresh: refreshGitStatus,
	} = useGitStatus(controller.gitSync.enabled ? 30000 : 0);

	const generalRef = useRef<HTMLDivElement>(null);
	const appearanceRef = useRef<HTMLDivElement>(null);
	const pluginsRef = useRef<HTMLDivElement>(null);
	const databaseRef = useRef<HTMLDivElement>(null);
	const shortcutsRef = useRef<HTMLDivElement>(null);
	const loggingRef = useRef<HTMLDivElement>(null);
	const backupRef = useRef<HTMLDivElement>(null);
	const syncRef = useRef<HTMLDivElement>(null);
	const aboutRef = useRef<HTMLDivElement>(null);

	const currentSectionIndexRef = useRef(0);
	const [settingsKey, setSettingsKey] = useState(0);
	const refMap = useMemo<Record<string, React.RefObject<HTMLDivElement | null>>>(
		() => ({
			general: generalRef,
			appearance: appearanceRef,
			plugins: pluginsRef,
			database: databaseRef,
			shortcuts: shortcutsRef,
			logging: loggingRef,
			backup: backupRef,
			sync: syncRef,
			about: aboutRef,
		}),
		[],
	);
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
						"about",
					]
				: [...BASE_SECTION_IDS],
		[enablePluginsSection],
	);

	useEffect(() => {
		setPageContext([], "Settings");
	}, [setPageContext]);

	const scrollToSection = useCallback(
		(sectionId: string) => {
			const ref = refMap[sectionId];
			if (ref?.current) {
				ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
			}

			const index = sectionIds.indexOf(sectionId as SettingsSectionId);
			if (index !== -1) {
				currentSectionIndexRef.current = index;
			}
		},
		[refMap, sectionIds],
	);

	// Track which section is near the top of the scroll area so the TOC can
	// highlight it as the user scrolls.
	const [activeSection, setActiveSection] = useState<SettingsSectionId>(sectionIds[0]);
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const topmost = entries
					.filter((e) => e.isIntersecting)
					.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				const id = topmost?.target.getAttribute("data-section-id");
				if (id) setActiveSection(id as SettingsSectionId);
			},
			{ rootMargin: "0px 0px -65% 0px", threshold: 0 },
		);
		for (const id of sectionIds) {
			const el = refMap[id]?.current;
			if (el) {
				el.setAttribute("data-section-id", id);
				observer.observe(el);
			}
		}
		return () => observer.disconnect();
	}, [refMap, sectionIds]);

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
		const nextIndex = Math.min(currentSectionIndexRef.current + 1, sectionIds.length - 1);
		currentSectionIndexRef.current = nextIndex;
		scrollToSection(sectionIds[nextIndex]);
	}, [scrollToSection, sectionIds]);

	const handlePreviousSection = useCallback(() => {
		const prevIndex = Math.max(currentSectionIndexRef.current - 1, 0);
		currentSectionIndexRef.current = prevIndex;
		scrollToSection(sectionIds[prevIndex]);
	}, [scrollToSection, sectionIds]);

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
		refreshGitStatus,
		// Section refs and navigation
		generalRef,
		appearanceRef,
		pluginsRef,
		databaseRef,
		shortcutsRef,
		loggingRef,
		backupRef,
		syncRef,
		aboutRef,
		// Error boundary retry
		settingsKey,
		setSettingsKey,
		sidebarSections,
		// In-page section navigation (TOC)
		sections,
		activeSection,
		scrollToSection,
	};
}
