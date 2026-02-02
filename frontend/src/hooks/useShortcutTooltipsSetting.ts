import { useCallback, useEffect, useState } from "react";
import {
	GetShowShortcutTooltips,
	SetShowShortcutTooltips,
} from "../../bindings/yanta/internal/system/service.js";

export interface UseShortcutTooltipsSettingReturn {
	showShortcutTooltips: boolean;
	isLoading: boolean;
	setShowShortcutTooltips: (show: boolean) => Promise<void>;
	toggleShortcutTooltips: () => Promise<void>;
}

/**
 * Hook to manage the shortcut tooltips visibility setting.
 * When disabled, tooltips showing keyboard shortcuts will not appear.
 */
export function useShortcutTooltipsSetting(): UseShortcutTooltipsSettingReturn {
	const [showShortcutTooltips, setShowShortcutTooltipsState] = useState<boolean>(true);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		GetShowShortcutTooltips()
			.then((show) => {
				setShowShortcutTooltipsState(show);
			})
			.catch((err) => {
				console.error("[useShortcutTooltipsSetting] Failed to get shortcut tooltips visibility:", err);
				// Default to true on error so tooltips are shown
				setShowShortcutTooltipsState(true);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	const setShowShortcutTooltipsAsync = useCallback(async (show: boolean) => {
		const previousValue = showShortcutTooltips;
		// Optimistic update
		setShowShortcutTooltipsState(show);

		try {
			await SetShowShortcutTooltips(show);
		} catch (err) {
			console.error("[useShortcutTooltipsSetting] Failed to set shortcut tooltips visibility:", err);
			// Revert on error
			setShowShortcutTooltipsState(previousValue);
			throw err;
		}
	}, [showShortcutTooltips]);

	const toggleShortcutTooltips = useCallback(async () => {
		const newShow = !showShortcutTooltips;
		await setShowShortcutTooltipsAsync(newShow);
	}, [showShortcutTooltips, setShowShortcutTooltipsAsync]);

	return {
		showShortcutTooltips,
		isLoading,
		setShowShortcutTooltips: setShowShortcutTooltipsAsync,
		toggleShortcutTooltips,
	};
}
