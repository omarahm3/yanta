import type { HelpCommand } from "../types";

/**
 * Global commands available on any page in the application
 */
export const GLOBAL_COMMANDS: HelpCommand[] = [
	{
		command: "switch @alias",
		description: "Switch to a different project by alias",
	},
	{
		command: "sync",
		description: "Sync changes to Git repository",
	},
];
