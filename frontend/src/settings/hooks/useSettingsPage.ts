import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SETTINGS_SHORTCUTS } from "../../config";
import {
	useFooterHintsSetting,
	useGitStatus,
	useHelp,
	useHotkeys,
	useShortcutTooltipsSetting,
	useSidebarSetting,
} from "../../hooks";
import { useSidebarSections } from "../../hooks/useSidebarSections";
import type { PageName } from "../../types";
import { useSettingsController } from "../useSettingsController";

const SECTION_IDS = [
	"general",
	"appearance",
	"database",
	"shortcuts",
	"logging",
	"backup",
	"sync",
	"about",
] as const;

export interface UseSettingsPageProps {
	onNavigate?: (page: PageName) => void;
}

export function useSettingsPage({ onNavigate }: UseSettingsPageProps) {
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

	const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
	const [settingsKey, setSettingsKey] = useState(0);

	useEffect(() => {
		setPageContext([], "Settings");
	}, [setPageContext]);

	const scrollToSection = useCallback((sectionId: string) => {
		const refMap: Record<string, React.RefObject<HTMLDivElement | null>> = {
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

		const index = SECTION_IDS.indexOf(sectionId as (typeof SECTION_IDS)[number]);
		if (index !== -1) {
			setCurrentSectionIndex(index);
		}
	}, []);

	const handleNextSection = useCallback(() => {
		const nextIndex = Math.min(currentSectionIndex + 1, SECTION_IDS.length - 1);
		setCurrentSectionIndex(nextIndex);
		scrollToSection(SECTION_IDS[nextIndex]);
	}, [currentSectionIndex, scrollToSection]);

	const handlePreviousSection = useCallback(() => {
		const prevIndex = Math.max(currentSectionIndex - 1, 0);
		setCurrentSectionIndex(prevIndex);
		scrollToSection(SECTION_IDS[prevIndex]);
	}, [currentSectionIndex, scrollToSection]);

	const hotkeys = useMemo(
		() => [
			{ ...SETTINGS_SHORTCUTS.navNext, handler: handleNextSection, allowInInput: false },
			{ ...SETTINGS_SHORTCUTS.navPrev, handler: handlePreviousSection, allowInInput: false },
		],
		[handleNextSection, handlePreviousSection],
	);

	useHotkeys(hotkeys);

	const settingsItems = useMemo(
		() =>
			SECTION_IDS.map((id) => ({
				id,
				label: id,
				onClick: () => scrollToSection(id),
			})),
		[scrollToSection],
	);

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
		// Git status
		gitStatus,
		gitStatusLoading,
		refreshGitStatus,
		// Section refs and navigation
		generalRef,
		appearanceRef,
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
	};
}
