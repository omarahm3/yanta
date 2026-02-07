/**
 * Utils - Re-export all utility functions
 */

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
// Re-export from command-palette domain for backward compatibility
export {
	getRecentlyUsedCommands,
	getTopRecentCommandIds,
	isRecentlyUsed,
	sortCommandsByUsage,
	preprocessCommand,
} from "../command-palette";
export { formatRelativeTime, formatShortDate } from "./dateUtils";
export { getShortcutForCommand } from "./shortcuts";
