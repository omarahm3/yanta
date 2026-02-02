import { useCallback, useEffect, useState } from "react";

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

function loadCommandUsage(): CommandUsageRecord {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (!stored) {
			return {};
		}
		const parsed = JSON.parse(stored);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return {};
		}
		// Validate the structure
		const validated: CommandUsageRecord = {};
		for (const [key, value] of Object.entries(parsed)) {
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
	} catch {
		return {};
	}
}

function saveCommandUsage(usage: CommandUsageRecord): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
	} catch (err) {
		console.error("[useCommandUsage] Failed to save to localStorage:", err);
	}
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
	const [usageData, setUsageData] = useState<CommandUsageRecord>(() => {
		const loaded = loadCommandUsage();
		// Run cleanup on initial load
		const pruned = pruneUsageData(loaded);
		if (Object.keys(pruned).length !== Object.keys(loaded).length) {
			saveCommandUsage(pruned);
		}
		return pruned;
	});

	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				setUsageData(loadCommandUsage());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, []);

	const recordCommandUsage = useCallback((commandId: string) => {
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

			// Prune if needed
			const pruned = pruneUsageData(updated);
			saveCommandUsage(pruned);
			return pruned;
		});
	}, []);

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
