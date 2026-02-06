import { useCallback } from "react";
import { BackendLogger } from "../utils/backendLogger";
import { useLocalStorage } from "../shared/hooks/useLocalStorage";

const STORAGE_KEY = "yanta_tooltip_usage";
const FADE_THRESHOLD = 5;
const DORMANCY_DAYS = 30;
const DORMANCY_MS = DORMANCY_DAYS * 24 * 60 * 60 * 1000;

export interface TooltipUsageData {
	seenCount: number;
	lastSeen: number;
}

export type TooltipUsageRecord = Record<string, TooltipUsageData>;

export interface UseTooltipUsageOptions {
	/** If true, tooltips are globally disabled regardless of usage tracking */
	globalDisabled?: boolean;
}

export interface UseTooltipUsageReturn {
	shouldShowTooltip: (tooltipId: string) => boolean;
	recordTooltipView: (tooltipId: string) => void;
	getTooltipUsage: (tooltipId: string) => TooltipUsageData | undefined;
	getAllTooltipUsage: () => TooltipUsageRecord;
}

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

export function useTooltipUsage(options: UseTooltipUsageOptions = {}): UseTooltipUsageReturn {
	const { globalDisabled = false } = options;

	const [usageData, setUsageData] = useLocalStorage<TooltipUsageRecord>(
		STORAGE_KEY,
		{},
		{
			validate: validateTooltipUsage,
			onError: (operation, err) => {
				BackendLogger.error(`[useTooltipUsage] Failed to ${operation}:`, err);
			},
		},
	);

	const shouldShowTooltip = useCallback(
		(tooltipId: string): boolean => {
			// If tooltips are globally disabled, always return false
			if (globalDisabled) {
				return false;
			}

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
		[usageData, globalDisabled],
	);

	const recordTooltipView = useCallback(
		(tooltipId: string) => {
			setUsageData((current) => {
				const existingEntry = current[tooltipId];
				const now = Date.now();

				return {
					...current,
					[tooltipId]: {
						seenCount: (existingEntry?.seenCount ?? 0) + 1,
						lastSeen: now,
					},
				};
			});
		},
		[setUsageData],
	);

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
