import { useCallback, useState } from "react";
import { BackendLogger } from "../utils/backendLogger";
import { useLocalStorage } from "./useLocalStorage";

const STORAGE_KEY = "yanta_command_usage";
const MAX_ENTRIES = 100;

export interface CommandUsageData {
	lastUsed: number;
	useCount: number;
}

export type CommandUsageRecord = Record<string, CommandUsageData>;

export interface UseCommandUsageReturn {
	recordCommandUsage: (commandId: string) => void;
	getCommandUsage: (commandId: string) => CommandUsageData | undefined;
	getAllCommandUsage: () => CommandUsageRecord;
}

function validateCommandUsage(data: unknown): CommandUsageRecord | null {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	const validated: CommandUsageRecord = {};
	for (const [key, value] of Object.entries(data)) {
		if (
			typeof key === "string" &&
			typeof value === "object" &&
			value !== null &&
			typeof (value as CommandUsageData).lastUsed === "number" &&
			typeof (value as CommandUsageData).useCount === "number"
		) {
			validated[key] = value as CommandUsageData;
		}
	}
	return validated;
}

function pruneUsageData(usage: CommandUsageRecord): CommandUsageRecord {
	const entries = Object.entries(usage);
	if (entries.length <= MAX_ENTRIES) {
		return usage;
	}

	// Sort by lastUsed (oldest first) and remove the excess entries
	const sorted = entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
	const toKeep = sorted.slice(entries.length - MAX_ENTRIES);

	const pruned: CommandUsageRecord = {};
	for (const [key, value] of toKeep) {
		pruned[key] = value;
	}

	return pruned;
}

export function useCommandUsage(): UseCommandUsageReturn {
	const [usageData, setUsageData] = useLocalStorage<CommandUsageRecord>(
		STORAGE_KEY,
		{},
		{
			validate: (data) => {
				const validated = validateCommandUsage(data);
				if (validated === null) return null;
				return pruneUsageData(validated);
			},
			onError: (operation, err) => {
				BackendLogger.error(`[useCommandUsage] Failed to ${operation}:`, err);
			},
		},
	);

	const recordCommandUsage = useCallback(
		(commandId: string) => {
			setUsageData((current) => {
				const existingEntry = current[commandId];
				const now = Date.now();

				const updated: CommandUsageRecord = {
					...current,
					[commandId]: {
						lastUsed: now,
						useCount: (existingEntry?.useCount ?? 0) + 1,
					},
				};

				return pruneUsageData(updated);
			});
		},
		[setUsageData],
	);

	const getCommandUsage = useCallback(
		(commandId: string): CommandUsageData | undefined => {
			return usageData[commandId];
		},
		[usageData],
	);

	const getAllCommandUsage = useCallback((): CommandUsageRecord => {
		return usageData;
	}, [usageData]);

	return {
		recordCommandUsage,
		getCommandUsage,
		getAllCommandUsage,
	};
}
