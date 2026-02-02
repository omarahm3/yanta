import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "yanta_tooltip_usage";
const FADE_THRESHOLD = 5;
const DORMANCY_DAYS = 30;
const DORMANCY_MS = DORMANCY_DAYS * 24 * 60 * 60 * 1000;

export interface TooltipUsageData {
	seenCount: number;
	lastSeen: number;
}

export type TooltipUsageRecord = Record<string, TooltipUsageData>;

export interface UseTooltipUsageReturn {
	shouldShowTooltip: (tooltipId: string) => boolean;
	recordTooltipView: (tooltipId: string) => void;
	getTooltipUsage: (tooltipId: string) => TooltipUsageData | undefined;
	getAllTooltipUsage: () => TooltipUsageRecord;
}

function loadTooltipUsage(): TooltipUsageRecord {
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
		const validated: TooltipUsageRecord = {};
		for (const [key, value] of Object.entries(parsed)) {
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
	} catch {
		return {};
	}
}

function saveTooltipUsage(usage: TooltipUsageRecord): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
	} catch (err) {
		console.error("[useTooltipUsage] Failed to save to localStorage:", err);
	}
}

export function useTooltipUsage(): UseTooltipUsageReturn {
	const [usageData, setUsageData] = useState<TooltipUsageRecord>(() => {
		return loadTooltipUsage();
	});

	useEffect(() => {
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === STORAGE_KEY) {
				setUsageData(loadTooltipUsage());
			}
		};

		window.addEventListener("storage", handleStorageChange);
		return () => {
			window.removeEventListener("storage", handleStorageChange);
		};
	}, []);

	const shouldShowTooltip = useCallback(
		(tooltipId: string): boolean => {
			const tooltipData = usageData[tooltipId];

			// If tooltip hasn't been seen before, show it
			if (!tooltipData) {
				return true;
			}

			// If seenCount is below the fade threshold, show it
			if (tooltipData.seenCount < FADE_THRESHOLD) {
				return true;
			}

			// If lastSeen was more than 30 days ago (dormancy reset), show it
			const now = Date.now();
			if (now - tooltipData.lastSeen > DORMANCY_MS) {
				return true;
			}

			// Tooltip has been seen enough times recently, don't show it
			return false;
		},
		[usageData],
	);

	const recordTooltipView = useCallback((tooltipId: string) => {
		setUsageData((current) => {
			const existingEntry = current[tooltipId];
			const now = Date.now();

			const updated: TooltipUsageRecord = {
				...current,
				[tooltipId]: {
					seenCount: (existingEntry?.seenCount ?? 0) + 1,
					lastSeen: now,
				},
			};

			saveTooltipUsage(updated);
			return updated;
		});
	}, []);

	const getTooltipUsage = useCallback(
		(tooltipId: string): TooltipUsageData | undefined => {
			return usageData[tooltipId];
		},
		[usageData],
	);

	const getAllTooltipUsage = useCallback((): TooltipUsageRecord => {
		return usageData;
	}, [usageData]);

	return {
		shouldShowTooltip,
		recordTooltipView,
		getTooltipUsage,
		getAllTooltipUsage,
	};
}
