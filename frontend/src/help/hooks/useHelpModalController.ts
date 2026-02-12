import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	formatShortcutKeyForDisplay,
	GLOBAL_COMMANDS,
	getHelpShortcutsFromConfig,
	TIMEOUTS,
} from "../../config";
import { useHotkeyContext } from "../../hotkeys";
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

	const [searchQuery, setSearchQuery] = useState("");
	const [expandedSections, setExpandedSections] = useState<Set<HelpSectionId>>(new Set());
	const [announcement, setAnnouncement] = useState("");
	const searchInputRef = useRef<HTMLInputElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);

	const announce = useCallback((message: string) => {
		setAnnouncement("");
		setTimeout(() => setAnnouncement(message), TIMEOUTS.helpAnnounceDelayMs);
	}, []);

	useEffect(() => {
		if (isOpen) {
			setExpandedSections(getDefaultExpandedSections(pageName));
			setSearchQuery("");
			setAnnouncement("");
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, TIMEOUTS.focusRestoreMs);
		}
	}, [isOpen, pageName]);

	useEffect(() => {
		if (!isOpen) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "?") {
				e.preventDefault();
				closeHelp();
			} else if (e.key === "Escape") {
				if (searchQuery.trim()) {
					e.preventDefault();
					e.stopPropagation();
					setSearchQuery("");
					searchInputRef.current?.focus();
					announce("Search cleared");
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, closeHelp, searchQuery, announce]);

	const allHotkeys = useMemo(() => {
		if (pageName === "SETTINGS") return [];
		return getRegisteredHotkeys().filter((h) => h.description && h.description !== "Toggle help");
	}, [getRegisteredHotkeys, pageName]);

	const sections: HelpSectionData[] = useMemo(() => {
		const fromConfig = getHelpShortcutsFromConfig();
		const sectionMap: Record<HelpSectionId, { key: string; description: string }[]> = {
			global: fromConfig.global,
			navigation: [
				{ key: "Ctrl+J", description: "Go to Journal" },
				{ key: "Ctrl+T", description: "Jump to Today" },
				{ key: "Ctrl+E", description: "Recent Documents" },
				{ key: "Ctrl+Tab", description: "Switch to last project" },
				{ key: "Ctrl+Shift+F", description: "Go to Search" },
				{ key: "Ctrl+D", description: "Go to Documents" },
			],
			documents: fromConfig.documents,
			journal: fromConfig.journal,
			editor: fromConfig.editor,
			git: [{ key: "Ctrl+Shift+S", description: "Git Sync" }],
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
	}, [allHotkeys]);

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
