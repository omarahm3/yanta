import type { CommandOption } from "../../shared/ui/CommandPalette";
import type { CommandUsageRecord } from "../hooks";

/**
 * Time constants for recency scoring
 */
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Weight constants for sorting
 * These are tuned to provide subtle boosts without drastically reordering
 */
const WEIGHTS = {
	// Recency weights (higher = more recent = higher priority)
	RECENCY_LAST_HOUR: 50,
	RECENCY_LAST_DAY: 30,
	RECENCY_LAST_WEEK: 15,
	RECENCY_OLDER: 5,

	// Frequency weight multiplier (capped to prevent over-boosting)
	FREQUENCY_MULTIPLIER: 2,
	MAX_FREQUENCY_BOOST: 20,
} as const;

/**
 * Calculate a recency score for a command based on when it was last used.
 * Higher scores for more recently used commands.
 */
function calculateRecencyScore(lastUsed: number, now: number): number {
	const age = now - lastUsed;

	if (age < HOUR_MS) {
		return WEIGHTS.RECENCY_LAST_HOUR;
	}
	if (age < DAY_MS) {
		return WEIGHTS.RECENCY_LAST_DAY;
	}
	if (age < WEEK_MS) {
		return WEIGHTS.RECENCY_LAST_WEEK;
	}
	return WEIGHTS.RECENCY_OLDER;
}

/**
 * Calculate a frequency score for a command based on use count.
 * Capped to prevent commands with very high usage from dominating.
 */
function calculateFrequencyScore(useCount: number): number {
	const raw = useCount * WEIGHTS.FREQUENCY_MULTIPLIER;
	return Math.min(raw, WEIGHTS.MAX_FREQUENCY_BOOST);
}

/**
 * Calculate total usage score for a command.
 */
function calculateUsageScore(commandId: string, usage: CommandUsageRecord, now: number): number {
	const usageData = usage[commandId];
	if (!usageData) {
		return 0;
	}

	const recencyScore = calculateRecencyScore(usageData.lastUsed, now);
	const frequencyScore = calculateFrequencyScore(usageData.useCount);

	return recencyScore + frequencyScore;
}

/**
 * Sort commands by usage while preserving group order.
 *
 * The sorting is subtle - it boosts recently/frequently used commands
 * within their groups rather than completely reordering everything.
 *
 * Sorting logic:
 * 1. Commands are sorted primarily by their usage score (recency + frequency)
 * 2. The sorting is applied within the context of groups
 * 3. Commands without usage data appear in their original order
 *
 * @param commands - The array of commands to sort
 * @param usage - The command usage record from localStorage
 * @returns A new array of commands sorted by usage
 */
export function sortCommandsByUsage(
	commands: CommandOption[],
	usage: CommandUsageRecord,
): CommandOption[] {
	const now = Date.now();

	// Create a copy with calculated scores
	const commandsWithScores = commands.map((command, originalIndex) => ({
		command,
		score: calculateUsageScore(command.id, usage, now),
		originalIndex, // Preserve original order for commands with same score
	}));

	// Sort by score (descending), then by original index (ascending) for stability
	commandsWithScores.sort((a, b) => {
		// Primary sort: by score (higher first)
		const scoreDiff = b.score - a.score;
		if (scoreDiff !== 0) {
			return scoreDiff;
		}
		// Secondary sort: by original index (preserve original order)
		return a.originalIndex - b.originalIndex;
	});

	return commandsWithScores.map((item) => item.command);
}

/**
 * Get the top N recently used commands for quick access.
 * Useful for displaying a "Recent" section.
 *
 * @param commands - The array of commands to filter
 * @param usage - The command usage record
 * @param limit - Maximum number of commands to return (default: 5)
 * @returns Commands that were recently used, sorted by recency
 */
export function getRecentlyUsedCommands(
	commands: CommandOption[],
	usage: CommandUsageRecord,
	limit = 5,
): CommandOption[] {
	const now = Date.now();

	// Filter to commands that have usage data and were used within the last week
	const recentCommands = commands.filter((command) => {
		const usageData = usage[command.id];
		return usageData && now - usageData.lastUsed < WEEK_MS;
	});

	// Sort by lastUsed (most recent first)
	recentCommands.sort((a, b) => {
		const aUsage = usage[a.id];
		const bUsage = usage[b.id];
		return (bUsage?.lastUsed ?? 0) - (aUsage?.lastUsed ?? 0);
	});

	return recentCommands.slice(0, limit);
}

/**
 * Check if a command was used recently (within the last hour).
 * Useful for applying visual indicators.
 *
 * @param commandId - The command ID to check
 * @param usage - The command usage record
 * @returns True if the command was used within the last hour
 */
export function isRecentlyUsed(commandId: string, usage: CommandUsageRecord): boolean {
	const usageData = usage[commandId];
	if (!usageData) {
		return false;
	}
	return Date.now() - usageData.lastUsed < HOUR_MS;
}

/**
 * Get the IDs of the top N most recently used commands for visual indicators.
 * Only returns commands that were used within the current session (last hour).
 *
 * @param usage - The command usage record
 * @param limit - Maximum number of command IDs to return (default: 5)
 * @returns Set of command IDs that should show the recent indicator
 */
export function getTopRecentCommandIds(usage: CommandUsageRecord, limit = 5): Set<string> {
	const now = Date.now();

	// Get all entries used within the last hour (session-level recency)
	const recentEntries = Object.entries(usage)
		.filter(([, data]) => now - data.lastUsed < HOUR_MS)
		.sort((a, b) => b[1].lastUsed - a[1].lastUsed);

	// Return the top N as a Set for O(1) lookups
	const topIds = recentEntries.slice(0, limit).map(([id]) => id);
	return new Set(topIds);
}
