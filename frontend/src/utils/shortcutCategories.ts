import type { RegisteredHotkey } from "../types";

/**
 * Available shortcut categories
 */
export type ShortcutCategory =
	| "navigation"
	| "editing"
	| "search"
	| "git"
	| "project"
	| "system"
	| "general";

/**
 * Category metadata with display information
 */
export interface CategoryInfo {
	id: ShortcutCategory;
	displayName: string;
	icon: string;
	description: string;
}

/**
 * Category definitions with display names and icons
 */
export const CATEGORY_INFO: Record<ShortcutCategory, CategoryInfo> = {
	navigation: {
		id: "navigation",
		displayName: "Navigation",
		icon: "🧭",
		description: "Move around the application",
	},
	editing: {
		id: "editing",
		displayName: "Editing",
		icon: "✏️",
		description: "Edit and modify content",
	},
	search: {
		id: "search",
		displayName: "Search",
		icon: "🔍",
		description: "Find and filter content",
	},
	git: {
		id: "git",
		displayName: "Git",
		icon: "📦",
		description: "Version control operations",
	},
	project: {
		id: "project",
		displayName: "Project",
		icon: "📁",
		description: "Project management",
	},
	system: {
		id: "system",
		displayName: "System",
		icon: "⚙️",
		description: "Application settings and help",
	},
	general: {
		id: "general",
		displayName: "General",
		icon: "📋",
		description: "Miscellaneous shortcuts",
	},
};

/**
 * Default order for displaying categories
 */
export const CATEGORY_ORDER: ShortcutCategory[] = [
	"navigation",
	"editing",
	"search",
	"git",
	"project",
	"system",
	"general",
];

/**
 * Grouped shortcuts by category
 */
export interface GroupedShortcuts {
	category: ShortcutCategory;
	info: CategoryInfo;
	shortcuts: RegisteredHotkey[];
}

/**
 * Infer category from hotkey configuration
 * @param hotkey The hotkey to categorize
 * @returns The inferred category
 */
export function inferCategory(hotkey: RegisteredHotkey): ShortcutCategory {
	// If category is already set, return it
	if (hotkey.category) {
		return hotkey.category as ShortcutCategory;
	}

	const key = hotkey.key.toLowerCase();
	const description = (hotkey.description || "").toLowerCase();

	// Navigation patterns
	if (
		/^[jk]$/.test(key) ||
		key.includes("arrow") ||
		key.includes("tab") ||
		description.includes("navigate") ||
		description.includes("move") ||
		description.includes("next") ||
		description.includes("previous") ||
		description.includes("scroll")
	) {
		return "navigation";
	}

	// Editing patterns
	if (
		key.includes("ctrl+s") ||
		key.includes("meta+s") ||
		key.includes("ctrl+e") ||
		key.includes("meta+e") ||
		key.includes("ctrl+z") ||
		key.includes("meta+z") ||
		description.includes("save") ||
		description.includes("edit") ||
		description.includes("undo") ||
		description.includes("delete") ||
		description.includes("create")
	) {
		return "editing";
	}

	// Search patterns
	if (
		key.includes("ctrl+p") ||
		key.includes("meta+p") ||
		key.includes("ctrl+f") ||
		key.includes("meta+f") ||
		key === "/" ||
		description.includes("search") ||
		description.includes("find") ||
		description.includes("filter") ||
		description.includes("palette")
	) {
		return "search";
	}

	// Git patterns
	if (
		key.startsWith("g") ||
		description.includes("git") ||
		description.includes("commit") ||
		description.includes("sync") ||
		description.includes("push") ||
		description.includes("pull")
	) {
		return "git";
	}

	// Project patterns
	if (
		key.includes("ctrl+n") ||
		key.includes("meta+n") ||
		description.includes("project") ||
		description.includes("switch") ||
		description.includes("workspace")
	) {
		return "project";
	}

	// System patterns
	if (
		key === "?" ||
		key.includes("ctrl+,") ||
		key.includes("meta+,") ||
		key === "escape" ||
		key === "esc" ||
		description.includes("help") ||
		description.includes("settings") ||
		description.includes("close") ||
		description.includes("dismiss")
	) {
		return "system";
	}

	// Default to general
	return "general";
}

/**
 * Group shortcuts by category
 * @param shortcuts Array of registered hotkeys
 * @returns Array of grouped shortcuts ordered by CATEGORY_ORDER
 */
export function groupShortcutsByCategory(
	shortcuts: RegisteredHotkey[],
): GroupedShortcuts[] {
	// First, categorize all shortcuts
	const categorized = shortcuts.map((shortcut) => ({
		...shortcut,
		category: inferCategory(shortcut),
	}));

	// Group by category
	const grouped = new Map<ShortcutCategory, RegisteredHotkey[]>();

	for (const shortcut of categorized) {
		const category = shortcut.category as ShortcutCategory;
		if (!grouped.has(category)) {
			grouped.set(category, []);
		}
		grouped.get(category)?.push(shortcut);
	}

	// Return in specified order, only including categories that have shortcuts
	return CATEGORY_ORDER.filter((category) => grouped.has(category)).map(
		(category) => ({
			category,
			info: CATEGORY_INFO[category],
			shortcuts: grouped.get(category) || [],
		}),
	);
}
