import { useCallback, useEffect } from "react";
import { create } from "zustand";
import type { PersistStorage } from "zustand/middleware";
import { persist } from "zustand/middleware";
import { BackendLogger } from "../../utils/backendLogger";

const STORAGE_KEY = "yanta_tooltip_usage";
const FADE_THRESHOLD = 5;
const DORMANCY_DAYS = 30;
const DORMANCY_MS = DORMANCY_DAYS * 24 * 60 * 60 * 1000;

export interface TooltipUsageData {
	seenCount: number;
	lastSeen: number;
}

export type TooltipUsageRecord = Record<string, TooltipUsageData>;

function validateTooltipUsage(data: unknown): TooltipUsageRecord | null {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return null;
	}
	const validated: TooltipUsageRecord = {};
	for (const [key, value] of Object.entries(data)) {
		if (
			typeof key === "string" &&
			typeof value === "object" &&
			value !== null &&
			typeof (value as TooltipUsageData).seenCount === "number" &&
			typeof (value as TooltipUsageData).lastSeen === "number"
		) {
			validated[key] = value as TooltipUsageData;
		}
	}
	return validated;
}

interface TooltipUsageState {
	usage: TooltipUsageRecord;
	recordTooltipView: (tooltipId: string) => void;
	getTooltipUsage: (tooltipId: string) => TooltipUsageData | undefined;
	getAllTooltipUsage: () => TooltipUsageRecord;
}

const tooltipUsageStorage: PersistStorage<{ usage: TooltipUsageRecord }> = {
	getItem: (name: string) => {
		try {
			const raw = localStorage.getItem(name);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as unknown;
			const usage = validateTooltipUsage(parsed);
			return usage !== null ? { state: { usage } } : null;
		} catch (err) {
			BackendLogger.error("[tooltipUsage.store] Failed to load:", err);
			return null;
		}
	},
	setItem: (name: string, value: { state: { usage: TooltipUsageRecord } }) => {
		try {
			localStorage.setItem(name, JSON.stringify(value.state.usage));
		} catch (err) {
			BackendLogger.error("[tooltipUsage.store] Failed to save:", err);
		}
	},
	removeItem: (name: string) => {
		try {
			localStorage.removeItem(name);
		} catch (err) {
			BackendLogger.error("[tooltipUsage.store] Failed to clear:", err);
		}
	},
};

export const useTooltipUsageStore = create<TooltipUsageState>()(
	persist(
		(set, get) => ({
			usage: {},
			recordTooltipView: (tooltipId: string) => {
				const { usage } = get();
				const existingEntry = usage[tooltipId];
				const now = Date.now();
				set({
					usage: {
						...usage,
						[tooltipId]: {
							seenCount: (existingEntry?.seenCount ?? 0) + 1,
							lastSeen: now,
						},
					},
				});
			},
			getTooltipUsage: (tooltipId: string) => get().usage[tooltipId],
			getAllTooltipUsage: () => get().usage,
		}),
		{
			name: STORAGE_KEY,
			storage: tooltipUsageStorage,
			partialize: (s) => ({ usage: s.usage }),
		},
	),
);

export interface UseTooltipUsageOptions {
	globalDisabled?: boolean;
}

export interface UseTooltipUsageReturn {
	shouldShowTooltip: (tooltipId: string) => boolean;
	recordTooltipView: (tooltipId: string) => void;
	getTooltipUsage: (tooltipId: string) => TooltipUsageData | undefined;
	getAllTooltipUsage: () => TooltipUsageRecord;
}

export function useTooltipUsage(options: UseTooltipUsageOptions = {}): UseTooltipUsageReturn {
	const { globalDisabled = false } = options;

	useEffect(() => {
		const handleStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) {
				useTooltipUsageStore.persist?.rehydrate();
			}
		};
		window.addEventListener("storage", handleStorage);
		return () => window.removeEventListener("storage", handleStorage);
	}, []);

	const usage = useTooltipUsageStore((s) => s.usage);
	const recordTooltipView = useTooltipUsageStore((s) => s.recordTooltipView);
	const getTooltipUsage = useTooltipUsageStore((s) => s.getTooltipUsage);
	const getAllTooltipUsage = useTooltipUsageStore((s) => s.getAllTooltipUsage);

	const shouldShowTooltip = useCallback(
		(tooltipId: string): boolean => {
			if (globalDisabled) return false;
			const tooltipData = usage[tooltipId];
			if (!tooltipData) return true;
			if (tooltipData.seenCount < FADE_THRESHOLD) return true;
			const now = Date.now();
			if (now - tooltipData.lastSeen > DORMANCY_MS) return true;
			return false;
		},
		[usage, globalDisabled],
	);

	return {
		shouldShowTooltip,
		recordTooltipView,
		getTooltipUsage,
		getAllTooltipUsage,
	};
}
