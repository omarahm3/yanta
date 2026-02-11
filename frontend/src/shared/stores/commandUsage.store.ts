import { useEffect } from "react";
import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { BackendLogger } from "../../utils/backendLogger";

const STORAGE_KEY = "yanta_command_usage";
const MAX_ENTRIES = 100;

export interface CommandUsageData {
	lastUsed: number;
	useCount: number;
}

export type CommandUsageRecord = Record<string, CommandUsageData>;

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
	const sorted = entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
	const toKeep = sorted.slice(entries.length - MAX_ENTRIES);
	const pruned: CommandUsageRecord = {};
	for (const [key, value] of toKeep) {
		pruned[key] = value;
	}
	return pruned;
}

interface CommandUsageState {
	usage: CommandUsageRecord;
	recordCommandUsage: (commandId: string) => void;
	getCommandUsage: (commandId: string) => CommandUsageData | undefined;
	getAllCommandUsage: () => CommandUsageRecord;
}

const commandUsageStorage: PersistStorage<{ usage: CommandUsageRecord }> = {
	getItem: (name: string) => {
		try {
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			const validated = validateCommandUsage(parsed);
			if (validated === null) return null;
			const usage = pruneUsageData(validated);
			return { state: { usage } };
		} catch (err) {
			BackendLogger.error("[commandUsage.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name: string, value: { state: { usage: CommandUsageRecord } }) => {
		try {
			// Save raw record for backwards compatibility (no wrapper)
			localStorage.setItem(name, JSON.stringify(value.state.usage));
		} catch (err) {
			BackendLogger.error("[commandUsage.store] Failed to save:", err);
		}
	},
	removeItem: (name: string) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[commandUsage.store] Failed to clear:", err);
		}
	},
};

export const useCommandUsageStore = create<CommandUsageState>()(
	persist(
		(set, get) => ({
			usage: {},
			recordCommandUsage: (commandId: string) => {
				const { usage } = get();
				const existingEntry = usage[commandId];
				const now = Date.now();
				const updated: CommandUsageRecord = {
					...usage,
					[commandId]: {
						lastUsed: now,
						useCount: (existingEntry?.useCount ?? 0) + 1,
					},
				};
				set({ usage: pruneUsageData(updated) });
			},
			getCommandUsage: (commandId: string) => get().usage[commandId],
			getAllCommandUsage: () => get().usage,
		}),
		{
			name: STORAGE_KEY,
			storage: commandUsageStorage,
			partialize: (s) => ({ usage: s.usage }),
		},
	),
);

export interface UseCommandUsageReturn {
	recordCommandUsage: (commandId: string) => void;
	getCommandUsage: (commandId: string) => CommandUsageData | undefined;
	getAllCommandUsage: () => CommandUsageRecord;
}

export function useCommandUsage(): UseCommandUsageReturn {
	// Cross-tab sync: rehydrate when another tab changes our key
	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
				useCommandUsageStore.persist?.rehydrate();
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const recordCommandUsage = useCommandUsageStore((s) => s.recordCommandUsage);
	const getCommandUsage = useCommandUsageStore((s) => s.getCommandUsage);
	const getAllCommandUsage = useCommandUsageStore((s) => s.getAllCommandUsage);
	return {
		recordCommandUsage,
		getCommandUsage,
		getAllCommandUsage,
	};
}
