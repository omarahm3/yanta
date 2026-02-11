/**
 * Tooltip usage is now in shared/stores/tooltipUsage.store (Zustand + persist).
 * Re-export so existing imports keep working.
 */
export {
	useTooltipUsage,
	type TooltipUsageData,
	type TooltipUsageRecord,
	type UseTooltipUsageOptions,
	type UseTooltipUsageReturn,
} from "../shared/stores/tooltipUsage.store";
