import { useCallback, useEffect, useState } from "react";
import {
	GetShowFooterHints,
	SetShowFooterHints,
} from "../../../bindings/yanta/internal/system/service.js";
import { BackendLogger } from "../utils/backendLogger";

export interface UseFooterHintsSettingReturn {
	showFooterHints: boolean;
	isLoading: boolean;
	setShowFooterHints: (show: boolean) => Promise<void>;
	toggleFooterHints: () => Promise<void>;
}

/**
 * Hook to manage the footer hints visibility setting.
 * Similar to useSidebarSetting but for the footer hint bar.
 */
export function useFooterHintsSetting(): UseFooterHintsSettingReturn {
	const [showFooterHints, setShowFooterHintsState] = useState<boolean>(true);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		GetShowFooterHints()
			.then((show) => {
				setShowFooterHintsState(show);
			})
			.catch((err) => {
				BackendLogger.error("[useFooterHintsSetting] Failed to get footer hints visibility:", err);
				// Default to true on error so hints are shown
				setShowFooterHintsState(true);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	const setShowFooterHintsAsync = useCallback(
		async (show: boolean) => {
			const previousValue = showFooterHints;
			// Optimistic update
			setShowFooterHintsState(show);

			try {
				await SetShowFooterHints(show);
			} catch (err) {
				BackendLogger.error("[useFooterHintsSetting] Failed to set footer hints visibility:", err);
				// Revert on error
				setShowFooterHintsState(previousValue);
				throw err;
			}
		},
		[showFooterHints],
	);

	const toggleFooterHints = useCallback(async () => {
		const newShow = !showFooterHints;
		await setShowFooterHintsAsync(newShow);
	}, [showFooterHints, setShowFooterHintsAsync]);

	return {
		showFooterHints,
		isLoading,
		setShowFooterHints: setShowFooterHintsAsync,
		toggleFooterHints,
	};
}
