/**
 * Tooltip usage is now in shared/stores/tooltipUsage.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export {
	type TooltipUsageData,
	type TooltipUsageRecord,
	type UseTooltipUsageOptions,
	type UseTooltipUsageReturn,
	useTooltipUsage,
} from "../shared/stores/tooltipUsage.store";
