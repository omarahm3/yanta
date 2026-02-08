/**
 * Utils - Re-export all utility functions
 */

// Re-export from command-palette domain for backward compatibility
export {
	getRecentlyUsedCommands,
	getTopRecentCommandIds,
	isRecentlyUsed,
	preprocessCommand,
	sortCommandsByUsage,
} from "../command-palette";
export { announceForScreenReaders } from "./accessibility";
export {
	blocksFromJson,
	blocksToJson,
	createSimpleBlock,
	extractHashtags,
	extractTitle,
	isEmptyContent,
	removeHashtags,
} from "./blocknote";
export { getProjectAliasColor } from "./colorUtils";
export { formatRelativeTime, formatShortDate } from "./dateUtils";
export { getShortcutForCommand } from "./shortcuts";
