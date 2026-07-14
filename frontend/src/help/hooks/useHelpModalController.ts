import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	EDITOR_HELP_COMMANDS,
	formatShortcutKeyForDisplay,
	GLOBAL_COMMANDS,
	getHelpShortcutsFromMerged,
} from "@/config/public";
import { useMergedConfig } from "@/config/usePreferencesOverrides";
import { useHotkeyContext } from "../../hotkeys";
import { classifyEventTarget } from "../../hotkeys/utils/hotkeyMatcher";
import { useLifoEscape } from "../../shared/hooks/useLifoEscape";
import type { HelpSectionData, HelpSectionId } from "../utils/helpModalUtils";
import { categorizeHotkey, getDefaultExpandedSections } from "../utils/helpModalUtils";
import { useHelp } from "./useHelp";

export interface UseHelpModalControllerResult {
	isOpen: boolean;
	closeHelp: () => void;
	pageCommands: { command: string; description: string }[];
	pageName: string;
	searchQuery: string;
	setSearchQuery: (value: string) => void;
	expandedSections: Set<HelpSectionId>;
	toggleSection: (sectionId: HelpSectionId, sectionTitle: string) => void;
	announcement: string;
	searchInputRef: React.RefObject<HTMLInputElement | null>;
	closeButtonRef: React.RefObject<HTMLButtonElement | null>;
	filteredSections: HelpSectionData[];
	filteredGlobalCommands: typeof GLOBAL_COMMANDS;
	filteredPageCommands: { command: string; description: string }[];
	hasSearchQuery: boolean;
	totalResults: number;
	handleOpenChange: (open: boolean) => void;
	handleClearSearch: () => void;
}

export function useHelpModalController(): UseHelpModalControllerResult {
	const { isOpen, closeHelp, pageCommands, pageName } = useHelp();
	const { getRegisteredHotkeys } = useHotkeyContext();
	const { timeouts, shortcuts } = useMergedConfig();

	const [searchQuery, setSearchQuery] = useState("");
	const [expandedSections, setExpandedSections] = useState<Set<HelpSectionId>>(new Set());
	const [announcement, setAnnouncement] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const announceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const focusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(
		() => () => {
			if (announceTimeoutRef.current !== null) {
				clearTimeout(announceTimeoutRef.current);
				announceTimeoutRef.current = null;
			}
			if (focusTimeoutRef.current !== null) {
				clearTimeout(focusTimeoutRef.current);
				focusTimeoutRef.current = null;
			}
		},
		[],
	);

	const announce = useCallback(
		(message: string) => {
			if (announceTimeoutRef.current !== null) {
				clearTimeout(announceTimeoutRef.current);
				announceTimeoutRef.current = null;
			}
			setAnnouncement("");
			announceTimeoutRef.current = setTimeout(() => {
				setAnnouncement(message);
				announceTimeoutRef.current = null;
			}, timeouts.helpAnnounceDelayMs);
		},
		[timeouts.helpAnnounceDelayMs],
	);

	useEffect(() => {
		if (isOpen) {
			setExpandedSections(getDefaultExpandedSections(pageName));
			setSearchQuery("");
			setAnnouncement("");
			if (focusTimeoutRef.current !== null) {
				clearTimeout(focusTimeoutRef.current);
			}
			focusTimeoutRef.current = setTimeout(() => {
				searchInputRef.current?.focus();
				focusTimeoutRef.current = null;
			}, timeouts.focusRestoreMs);
		} else if (focusTimeoutRef.current !== null) {
			clearTimeout(focusTimeoutRef.current);
			focusTimeoutRef.current = null;
		}
	}, [isOpen, pageName, timeouts.focusRestoreMs]);

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "?") {
				if (classifyEventTarget(e.target).inInputField) return;
				e.preventDefault();
				closeHelp();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, closeHelp, announce, setSearchQuery]);

	useLifoEscape({
		when: isOpen,
		onEscape: () => {
			// Only handle Escape when there's a search to clear; otherwise decline
			// so Escape falls through to the Radix Dialog and closes Help.
			if (searchInputRef.current?.value.trim()) {
				setSearchQuery("");
				searchInputRef.current?.focus();
				announce("Search cleared");
				return true;
			}
			return false;
		},
		skipWhenDialogOpen: false,
	});

	const allHotkeys = useMemo(() => {
		if (pageName === "SETTINGS") return [];
		return getRegisteredHotkeys().filter((h) => h.description && h.description !== "Toggle help");
	}, [getRegisteredHotkeys, pageName]);

	const sections: HelpSectionData[] = useMemo(() => {
		const fromConfig = getHelpShortcutsFromMerged(shortcuts);
		const editorCommands = EDITOR_HELP_COMMANDS.map((cmd) => ({
			key: formatShortcutKeyForDisplay(cmd.command),
			description: cmd.description,
		}));
		const sectionMap: Record<HelpSectionId, { key: string; description: string }[]> = {
			global: fromConfig.global,
			navigation: [
				{ key: formatShortcutKeyForDisplay("ctrl+j"), description: "Go to Journal" },
				{ key: formatShortcutKeyForDisplay("mod+T"), description: "Jump to Today" },
				{ key: formatShortcutKeyForDisplay("ctrl+e"), description: "Recent Documents" },
				{ key: formatShortcutKeyForDisplay("ctrl+Tab"), description: "Switch to last project" },
				{ key: formatShortcutKeyForDisplay("ctrl+d"), description: "Go to Documents" },
			],
			documents: fromConfig.documents,
			journal: fromConfig.journal,
			editor: [...fromConfig.editor, ...editorCommands],
			git: [{ key: formatShortcutKeyForDisplay("ctrl+shift+s"), description: "Git Sync" }],
		};

		const existingKeys = new Set(
			Object.values(sectionMap)
				.flat()
				.map((s) => s.key.toLowerCase().replace(/\s/g, "")),
		);

		for (const hotkey of allHotkeys) {
			const formatted = formatShortcutKeyForDisplay(hotkey.key);
			const normalizedKey = formatted.toLowerCase().replace(/\s/g, "");

			if (!existingKeys.has(normalizedKey)) {
				const category = categorizeHotkey(hotkey.key, hotkey.description || "");
				sectionMap[category].push({
					key: formatted,
					description: hotkey.description || "",
				});
				existingKeys.add(normalizedKey);
			}
		}

		const sectionTitles: Record<HelpSectionId, string> = {
			global: "Global Shortcuts",
			navigation: "Navigation",
			documents: "Documents",
			journal: "Journal",
			editor: "Editor",
			git: "Git Operations",
		};

		const sectionOrder: HelpSectionId[] = [
			"global",
			"navigation",
			"documents",
			"journal",
			"editor",
			"git",
		];

		return sectionOrder
			.map((id) => ({
				id,
				title: sectionTitles[id],
				shortcuts: sectionMap[id],
			}))
			.filter((section) => section.shortcuts.length > 0);
	}, [shortcuts, allHotkeys]);

	const filteredSections = useMemo(() => {
		if (!searchQuery.trim()) return sections;

		const query = searchQuery.toLowerCase();
		return sections
			.map((section) => ({
				...section,
				shortcuts: section.shortcuts.filter(
					(s) => s.key.toLowerCase().includes(query) || s.description.toLowerCase().includes(query),
				),
			}))
			.filter((section) => section.shortcuts.length > 0);
	}, [sections, searchQuery]);

	const filteredGlobalCommands = useMemo(() => {
		if (!searchQuery.trim()) return GLOBAL_COMMANDS;
		const query = searchQuery.toLowerCase();
		return GLOBAL_COMMANDS.filter(
			(cmd) =>
				cmd.command.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query),
		);
	}, [searchQuery]);

	const filteredPageCommands = useMemo(() => {
		if (!searchQuery.trim()) return pageCommands;
		const query = searchQuery.toLowerCase();
		return pageCommands.filter(
			(cmd) =>
				cmd.command.toLowerCase().includes(query) || cmd.description.toLowerCase().includes(query),
		);
	}, [pageCommands, searchQuery]);

	const hasSearchQuery = searchQuery.trim().length > 0;
	const totalShortcuts = filteredSections.reduce((acc, s) => acc + s.shortcuts.length, 0);
	const totalResults = filteredGlobalCommands.length + filteredPageCommands.length + totalShortcuts;

	useEffect(() => {
		if (hasSearchQuery && filteredSections.length > 0) {
			setExpandedSections(new Set(filteredSections.map((s) => s.id)));
		}
	}, [hasSearchQuery, filteredSections]);

	const toggleSection = useCallback(
		(sectionId: HelpSectionId, sectionTitle: string) => {
			setExpandedSections((prev) => {
				const next = new Set(prev);
				const willExpand = !next.has(sectionId);
				if (willExpand) {
					next.add(sectionId);
					announce(`${sectionTitle} section expanded`);
				} else {
					next.delete(sectionId);
					announce(`${sectionTitle} section collapsed`);
				}
				return next;
			});
		},
		[announce],
	);

	const handleOpenChange = useCallback(
		(open: boolean) => {
			if (!open) closeHelp();
		},
		[closeHelp],
	);

	const handleClearSearch = useCallback(() => {
		setSearchQuery("");
		searchInputRef.current?.focus();
	}, []);

	return {
		isOpen,
		closeHelp,
		pageCommands,
		pageName,
		searchQuery,
		setSearchQuery,
		expandedSections,
		toggleSection,
		announcement,
		searchInputRef,
		closeButtonRef,
		filteredSections,
		filteredGlobalCommands,
		filteredPageCommands,
		hasSearchQuery,
		totalResults,
		handleOpenChange,
		handleClearSearch,
	};
}
