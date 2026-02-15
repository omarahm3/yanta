import { useCallback, useEffect, useState } from "react";
import {
	GetShowShortcutTooltips,
	SetShowShortcutTooltips,
} from "../../../bindings/yanta/internal/system/service.js";
import { BackendLogger } from "../utils/backendLogger";
import { useFeatureFlag } from "./useFeatureFlag";

export interface UseShortcutTooltipsSettingReturn {
	showShortcutTooltips: boolean;
	isLoading: boolean;
	setShowShortcutTooltips: (show: boolean) => Promise<void>;
	toggleShortcutTooltips: () => Promise<void>;
}

/**
 * Hook to manage the shortcut tooltips visibility setting.
 * When disabled (or when YANTA_ENABLE_TOOLTIP_HINTS is not set), tooltips will not appear.
 */
export function useShortcutTooltipsSetting(): UseShortcutTooltipsSettingReturn {
	const { enabled: tooltipHintsEnabled, isLoading: featureFlagLoading } =
		useFeatureFlag("tooltipHints");
	const [showShortcutTooltips, setShowShortcutTooltipsState] = useState<boolean>(true);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		if (featureFlagLoading) {
			setIsLoading(true);
			return;
		}
		if (!tooltipHintsEnabled) {
			setShowShortcutTooltipsState(false);
			setIsLoading(false);
			return;
		}
		GetShowShortcutTooltips()
			.then((show) => {
				setShowShortcutTooltipsState(show);
			})
			.catch((err) => {
				BackendLogger.error(
					"[useShortcutTooltipsSetting] Failed to get shortcut tooltips visibility:",
					err,
				);
				setShowShortcutTooltipsState(true);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, [featureFlagLoading, tooltipHintsEnabled]);

	const setShowShortcutTooltipsAsync = useCallback(
		async (show: boolean) => {
			if (!tooltipHintsEnabled) return;
			const previousValue = showShortcutTooltips;
			setShowShortcutTooltipsState(show);
			try {
				await SetShowShortcutTooltips(show);
			} catch (err) {
				BackendLogger.error(
					"[useShortcutTooltipsSetting] Failed to set shortcut tooltips visibility:",
					err,
				);
				setShowShortcutTooltipsState(previousValue);
				throw err;
			}
		},
		[showShortcutTooltips, tooltipHintsEnabled],
	);

	const toggleShortcutTooltips = useCallback(async () => {
		if (!tooltipHintsEnabled) return;
		await setShowShortcutTooltipsAsync(!showShortcutTooltips);
	}, [showShortcutTooltips, setShowShortcutTooltipsAsync, tooltipHintsEnabled]);

	return {
		showShortcutTooltips: tooltipHintsEnabled ? showShortcutTooltips : false,
		isLoading,
		setShowShortcutTooltips: setShowShortcutTooltipsAsync,
		toggleShortcutTooltips,
	};
}
