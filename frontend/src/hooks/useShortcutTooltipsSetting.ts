import { useCallback, useEffect, useState } from "react";
import {
	GetShowShortcutTooltips,
	SetShowShortcutTooltips,
} from "../../bindings/yanta/internal/system/service.js";
import { ENABLE_TOOLTIP_HINTS } from "../config/featureFlags";
import { BackendLogger } from "../utils/backendLogger";

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
	const [showShortcutTooltips, setShowShortcutTooltipsState] = useState<boolean>(true);
	const [isLoading, setIsLoading] = useState<boolean>(ENABLE_TOOLTIP_HINTS);

	useEffect(() => {
		if (!ENABLE_TOOLTIP_HINTS) {
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
	}, []);

	const setShowShortcutTooltipsAsync = useCallback(
		async (show: boolean) => {
			if (!ENABLE_TOOLTIP_HINTS) return;
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
		[showShortcutTooltips],
	);

	const toggleShortcutTooltips = useCallback(async () => {
		if (!ENABLE_TOOLTIP_HINTS) return;
		await setShowShortcutTooltipsAsync(!showShortcutTooltips);
	}, [showShortcutTooltips, setShowShortcutTooltipsAsync]);

	return {
		showShortcutTooltips: ENABLE_TOOLTIP_HINTS ? showShortcutTooltips : false,
		isLoading,
		setShowShortcutTooltips: setShowShortcutTooltipsAsync,
		toggleShortcutTooltips,
	};
}
