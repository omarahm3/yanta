import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { GLOBAL_COMMANDS } from "../../constants/globalCommands";
import { useHotkeyContext } from "../../contexts/HotkeyContext";
import { useHelp } from "../../hooks/useHelp";
import { Heading } from "../ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

/**
 * Section definitions for the help modal
 */
type HelpSectionId = "global" | "navigation" | "documents" | "journal" | "editor" | "git";

interface ShortcutItem {
	key: string;
	description: string;
}

interface HelpSectionData {
	id: HelpSectionId;
	title: string;
	shortcuts: ShortcutItem[];
}

/**
 * Format hotkey string for display
 */
const formatHotkeyDisplay = (key: string): string => {
	return key
		.replace(/mod/gi, "Ctrl")
		.replace(/shift/gi, "Shift")
		.replace(/alt/gi, "Alt")
		.replace(/meta/gi, "Meta")
		.replace(/\+/g, "+")
		.split("+")
		.map((part) => {
			const keyMap: Record<string, string> = {
				Escape: "ESC",
				" ": "SPACE",
				Enter: "ENTER",
				Tab: "TAB",
				ArrowUp: "↑",
				ArrowDown: "↓",
				ArrowLeft: "←",
				ArrowRight: "→",
			};
			return keyMap[part] || part.toUpperCase();
		})
		.join("+");
};

/**
 * Get default expanded sections based on current page context
 */
const getDefaultExpandedSections = (pageName: string): Set<HelpSectionId> => {
	const normalizedPage = pageName.toUpperCase();

	switch (normalizedPage) {
		case "DASHBOARD":
			return new Set(["global", "navigation", "documents"]);
		case "JOURNAL":
			return new Set(["global", "navigation", "journal"]);
		case "DOCUMENT":
		case "EDITOR":
			return new Set(["global", "editor", "documents"]);
		case "SETTINGS":
			return new Set(["global"]);
		case "SEARCH":
			return new Set(["global", "navigation"]);
		default:
			return new Set(["global", "navigation"]);
	}
};

/**
 * Categorize a hotkey into a section
 */
const categorizeHotkey = (
	hotkeyKey: string,
	description: string,
): HelpSectionId => {
	const key = hotkeyKey.toLowerCase();
	const desc = description.toLowerCase();

	// Git operations
	if (
		desc.includes("git") ||
		desc.includes("sync") ||
		desc.includes("push") ||
		desc.includes("pull") ||
		desc.includes("commit")
	) {
		return "git";
	}

	// Journal operations
	if (
		desc.includes("journal") ||
		desc.includes("prev day") ||
		desc.includes("next day") ||
		desc.includes("today") ||
		key.includes("ctrl+left") ||
		key.includes("ctrl+right") ||
		key.includes("mod+left") ||
		key.includes("mod+right")
	) {
		return "journal";
	}

	// Editor operations
	if (
		desc.includes("save") ||
		desc.includes("bold") ||
		desc.includes("italic") ||
		desc.includes("format") ||
		desc.includes("undo") ||
		desc.includes("redo")
	) {
		return "editor";
	}

	// Document operations
	if (
		desc.includes("new document") ||
		desc.includes("new doc") ||
		desc.includes("export") ||
		desc.includes("archive") ||
		desc.includes("delete document")
	) {
		return "documents";
	}

	// Navigation operations
	if (
		desc.includes("go to") ||
		desc.includes("navigate") ||
		desc.includes("switch") ||
		desc.includes("recent") ||
		desc.includes("search") ||
		key.includes("tab")
	) {
		return "navigation";
	}

	// Global shortcuts
	if (
		desc.includes("command palette") ||
		desc.includes("palette") ||
		desc.includes("sidebar") ||
		desc.includes("settings") ||
		desc.includes("help") ||
		key === "?" ||
		key === "shift+/" ||
		key.includes("ctrl+k") ||
		key.includes("mod+k") ||
		key.includes("ctrl+b") ||
		key.includes("mod+b") ||
		key.includes("ctrl+,") ||
		key.includes("mod+,")
	) {
		return "global";
	}

	// Default to global for uncategorized
	return "global";
};

/**
 * Collapsible section component
 */
interface HelpSectionProps {
	title: string;
	isExpanded: boolean;
	onToggle: () => void;
	children: React.ReactNode;
	sectionId: string;
}

const HelpSection: React.FC<HelpSectionProps> = ({
	title,
	isExpanded,
	onToggle,
	children,
	sectionId,
}) => {
	const contentRef = useRef<HTMLDivElement>(null);

	return (
		<div className="border-b border-border/30 last:border-b-0">
			<button
				type="button"
				onClick={onToggle}
				className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-bg/50 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-inset"
				aria-expanded={isExpanded}
				aria-controls={`help-section-content-${sectionId}`}
			>
				<ChevronRight
					className={`w-4 h-4 text-text-dim transition-transform duration-150 ease-out ${
						isExpanded ? "rotate-90" : ""
					}`}
				/>
				<span className="font-medium text-text-bright text-sm tracking-wide">
					{title}
				</span>
			</button>
			<div
				id={`help-section-content-${sectionId}`}
				role="region"
				aria-labelledby={`help-section-header-${sectionId}`}
				className={`overflow-hidden transition-all duration-150 ease-out ${
					isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
				}`}
			>
				<div ref={contentRef} className="px-4 pb-3 pl-10">
					{children}
				</div>
			</div>
		</div>
	);
};

/**
 * Shortcut row component
 */
interface ShortcutRowProps {
	shortcutKey: string;
	description: string;
	variant?: "accent" | "green" | "purple";
}

const ShortcutRow: React.FC<ShortcutRowProps> = ({
	shortcutKey,
	description,
	variant = "purple",
}) => {
	const colorClasses = {
		accent: "border-accent/20 text-accent group-hover:border-accent/40 group-hover:bg-accent/5",
		green: "border-green/20 text-green group-hover:border-green/40 group-hover:bg-green/5",
		purple: "border-purple/20 text-purple group-hover:border-purple/40 group-hover:bg-purple/5",
	};

	return (
		<div className="grid grid-cols-[minmax(120px,auto)_1fr] items-baseline gap-4 font-mono text-sm group py-1.5 rounded hover:bg-bg/30 transition-colors">
			<code
				className={`px-2 py-1 bg-bg border rounded font-medium transition-all duration-200 text-xs w-fit ${colorClasses[variant]}`}
			>
				{shortcutKey}
			</code>
			<span className="text-text text-xs sm:text-sm">{description}</span>
		</div>
	);
};

/**
 * Main HelpModal component
 */
export const HelpModal: React.FC = () => {
	const { isOpen, closeHelp, pageCommands, pageName } = useHelp();
	const { getRegisteredHotkeys } = useHotkeyContext();
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedSections, setExpandedSections] = useState<Set<HelpSectionId>>(
		new Set(),
	);
	const searchInputRef = useRef<HTMLInputElement>(null);

	// Reset expanded sections and search when modal opens
	useEffect(() => {
		if (isOpen) {
			setExpandedSections(getDefaultExpandedSections(pageName));
			setSearchQuery("");
			setTimeout(() => {
				searchInputRef.current?.focus();
			}, 100);
		}
	}, [isOpen, pageName]);

	// Handle keyboard events
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
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, closeHelp, searchQuery]);

	// Get all registered hotkeys
	const allHotkeys = useMemo(() => {
		if (pageName === "SETTINGS") return [];
		return getRegisteredHotkeys().filter(
			(h) => h.description && h.description !== "Toggle help",
		);
	}, [getRegisteredHotkeys, pageName]);

	// Build sections data
	const sections: HelpSectionData[] = useMemo(() => {
		// Initialize sections
		const sectionMap: Record<HelpSectionId, ShortcutItem[]> = {
			global: [
				{ key: "Ctrl+K", description: "Open command palette" },
				{ key: "Ctrl+B", description: "Toggle sidebar" },
				{ key: "Ctrl+,", description: "Open settings" },
				{ key: "?", description: "Show this help" },
			],
			navigation: [
				{ key: "Ctrl+J", description: "Go to Journal" },
				{ key: "Ctrl+T", description: "Jump to Today" },
				{ key: "Ctrl+E", description: "Recent Documents" },
				{ key: "Ctrl+Tab", description: "Switch to last project" },
				{ key: "Ctrl+Shift+F", description: "Go to Search" },
				{ key: "Ctrl+D", description: "Go to Dashboard" },
			],
			documents: [
				{ key: "Ctrl+N", description: "New Document" },
				{ key: "Ctrl+S", description: "Save Document" },
			],
			journal: [
				{ key: "Ctrl+←", description: "Previous day" },
				{ key: "Ctrl+→", description: "Next day" },
			],
			editor: [],
			git: [{ key: "Ctrl+Shift+S", description: "Git Sync" }],
		};

		// Add shortcuts from registered hotkeys that aren't already in sections
		const existingKeys = new Set(
			Object.values(sectionMap)
				.flat()
				.map((s) => s.key.toLowerCase().replace(/\s/g, "")),
		);

		for (const hotkey of allHotkeys) {
			const formatted = formatHotkeyDisplay(hotkey.key);
			const normalizedKey = formatted.toLowerCase().replace(/\s/g, "");

			if (!existingKeys.has(normalizedKey)) {
				const category = categorizeHotkey(
					hotkey.key,
					hotkey.description || "",
				);
				sectionMap[category].push({
					key: formatted,
					description: hotkey.description || "",
				});
				existingKeys.add(normalizedKey);
			}
		}

		// Convert to array format
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

	// Filter sections based on search query
	const filteredSections = useMemo(() => {
		if (!searchQuery.trim()) return sections;

		const query = searchQuery.toLowerCase();
		return sections
			.map((section) => ({
				...section,
				shortcuts: section.shortcuts.filter(
					(s) =>
						s.key.toLowerCase().includes(query) ||
						s.description.toLowerCase().includes(query),
				),
			}))
			.filter((section) => section.shortcuts.length > 0);
	}, [sections, searchQuery]);

	// Filter global commands
	const filteredGlobalCommands = useMemo(() => {
		if (!searchQuery.trim()) return GLOBAL_COMMANDS;
		const query = searchQuery.toLowerCase();
		return GLOBAL_COMMANDS.filter(
			(cmd) =>
				cmd.command.toLowerCase().includes(query) ||
				cmd.description.toLowerCase().includes(query),
		);
	}, [searchQuery]);

	// Filter page commands
	const filteredPageCommands = useMemo(() => {
		if (!searchQuery.trim()) return pageCommands;
		const query = searchQuery.toLowerCase();
		return pageCommands.filter(
			(cmd) =>
				cmd.command.toLowerCase().includes(query) ||
				cmd.description.toLowerCase().includes(query),
		);
	}, [pageCommands, searchQuery]);

	// Calculate totals for search results
	const hasSearchQuery = searchQuery.trim().length > 0;
	const totalShortcuts = filteredSections.reduce(
		(acc, s) => acc + s.shortcuts.length,
		0,
	);
	const totalResults =
		filteredGlobalCommands.length + filteredPageCommands.length + totalShortcuts;

	// When searching, expand all sections with matches
	useEffect(() => {
		if (hasSearchQuery && filteredSections.length > 0) {
			setExpandedSections(new Set(filteredSections.map((s) => s.id)));
		}
	}, [hasSearchQuery, filteredSections]);

	const toggleSection = useCallback((sectionId: HelpSectionId) => {
		setExpandedSections((prev) => {
			const next = new Set(prev);
			if (next.has(sectionId)) {
				next.delete(sectionId);
			} else {
				next.add(sectionId);
			}
			return next;
		});
	}, []);

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			closeHelp();
		}
	};

	const handleClearSearch = () => {
		setSearchQuery("");
		searchInputRef.current?.focus();
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="w-[480px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-hidden bg-bg border border-border rounded-xl p-0"
				style={{
					boxShadow: "0 16px 48px rgba(0, 0, 0, 0.24)",
				}}
				showCloseButton={false}
			>
				<DialogHeader className="flex flex-row items-center justify-between px-4 py-4 border-b border-border/40">
					<DialogTitle className="text-base font-semibold text-text">
						Keyboard Shortcuts
					</DialogTitle>
					<button
						type="button"
						onClick={closeHelp}
						className="text-text-dim hover:text-text transition-colors text-xs font-mono"
						aria-label="Close"
					>
						ESC
					</button>
				</DialogHeader>

				{/* Search input */}
				<div className="px-4 pt-4 pb-2">
					<div className="relative">
						<input
							ref={searchInputRef}
							type="text"
							placeholder="Search shortcuts..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="w-full px-3 py-2 bg-surface border border-border/40 rounded-md text-text placeholder-text-dim focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/30 transition-all text-sm"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={handleClearSearch}
								className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-text-dim hover:text-text transition-colors rounded hover:bg-bg-dim"
								aria-label="Clear search"
							>
								Clear
							</button>
						)}
					</div>
					{hasSearchQuery && (
						<div className="mt-2 text-xs text-text-dim">
							{totalResults === 0 ? (
								<span className="text-red">
									No shortcuts found for "{searchQuery}"
								</span>
							) : (
								<span>
									Showing results for "{searchQuery}" (
									<span className="text-accent font-semibold">{totalResults}</span>{" "}
									found)
								</span>
							)}
						</div>
					)}
				</div>

				{/* Content */}
				<div className="overflow-y-auto max-h-[calc(70vh-140px)]">
					{/* Global commands section (colon commands) */}
					{filteredGlobalCommands.length > 0 && (
						<div className="px-4 py-3 border-b border-border/30">
							<Heading
								as="h3"
								variant="dim"
								size="sm"
								weight="bold"
								className="mb-3 tracking-wider uppercase text-xs"
							>
								COMMANDS
							</Heading>
							<div className="space-y-1">
								{filteredGlobalCommands.map((cmd) => (
									<ShortcutRow
										key={cmd.command}
										shortcutKey={`:${cmd.command}`}
										description={cmd.description}
										variant="green"
									/>
								))}
							</div>
						</div>
					)}

					{/* Page-specific commands */}
					{filteredPageCommands.length > 0 && (
						<div className="px-4 py-3 border-b border-border/30">
							<Heading
								as="h3"
								variant="dim"
								size="sm"
								weight="bold"
								className="mb-3 tracking-wider uppercase text-xs"
							>
								{pageName} COMMANDS
							</Heading>
							<div className="space-y-1">
								{filteredPageCommands.map((cmd) => (
									<ShortcutRow
										key={cmd.command}
										shortcutKey={cmd.command}
										description={cmd.description}
										variant="accent"
									/>
								))}
							</div>
						</div>
					)}

					{/* Collapsible shortcut sections */}
					{filteredSections.length > 0 && (
						<div>
							{filteredSections.map((section) => (
								<HelpSection
									key={section.id}
									sectionId={section.id}
									title={section.title}
									isExpanded={expandedSections.has(section.id)}
									onToggle={() => toggleSection(section.id)}
								>
									<div className="space-y-1">
										{section.shortcuts.map((shortcut) => (
											<ShortcutRow
												key={`${section.id}-${shortcut.key}`}
												shortcutKey={shortcut.key}
												description={shortcut.description}
												variant="purple"
											/>
										))}
									</div>
								</HelpSection>
							))}
						</div>
					)}

					{/* Empty state */}
					{totalResults === 0 && (
						<div className="py-12 px-6 text-center">
							<div className="space-y-4">
								<div className="text-4xl">🔍</div>
								<div className="text-sm font-medium text-text">
									No shortcuts found for "{searchQuery}"
								</div>
								<div className="text-xs text-text-dim">
									Try a different search term
								</div>
							</div>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
};
