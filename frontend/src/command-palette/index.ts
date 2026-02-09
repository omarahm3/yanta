// Public API for command-palette domain
export { GlobalCommandPalette } from "./components";
export type { CommandUsageData, CommandUsageRecord, UseCommandUsageReturn } from "./hooks";
export { useCommandUsage } from "./hooks";
export {
	useCommandRegistryStore,
	registerNavigationCommands,
	registerCreateCommands,
	registerDocumentCommands,
	registerGitCommands,
	registerProjectCommands,
	registerApplicationCommands,
} from "./registry";
export type { CommandRegistry, CommandRegistryContext } from "./registry";
export {
	getRecentlyUsedCommands,
	getTopRecentCommandIds,
	isRecentlyUsed,
	preprocessCommand,
	sortCommandsByUsage,
} from "./utils";
