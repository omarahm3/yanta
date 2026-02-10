/**
 * Help modal section and categorization utilities.
 * Used by useHelpModalController and HelpModal.
 */

export type HelpSectionId = "global" | "navigation" | "documents" | "journal" | "editor" | "git";

export interface ShortcutItem {
	key: string;
	description: string;
}

export interface HelpSectionData {
	id: HelpSectionId;
	title: string;
	shortcuts: ShortcutItem[];
}

/**
 * Get default expanded sections based on current page context
 */
export function getDefaultExpandedSections(pageName: string): Set<HelpSectionId> {
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
}

/**
 * Categorize a hotkey into a section
 */
export function categorizeHotkey(hotkeyKey: string, description: string): HelpSectionId {
	const key = hotkeyKey.toLowerCase();
	const desc = description.toLowerCase();

	if (
		desc.includes("git") ||
		desc.includes("sync") ||
		desc.includes("push") ||
		desc.includes("pull") ||
		desc.includes("commit")
	) {
		return "git";
	}

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

	if (
		desc.includes("new document") ||
		desc.includes("new doc") ||
		desc.includes("export") ||
		desc.includes("archive") ||
		desc.includes("delete document")
	) {
		return "documents";
	}

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

	return "global";
}
