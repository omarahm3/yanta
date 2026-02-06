import { useCallback, useEffect, useState } from "react";
import { GetSidebarVisible, SetSidebarVisible } from "../../bindings/yanta/internal/system/service";
import { announceForScreenReaders } from "../utils/accessibility";
import { BackendLogger } from "../utils/backendLogger";

export interface UseSidebarSettingReturn {
	sidebarVisible: boolean;
	isLoading: boolean;
	setSidebarVisible: (visible: boolean) => Promise<void>;
	toggleSidebar: () => Promise<void>;
}

export function useSidebarSetting(): UseSidebarSettingReturn {
	const [sidebarVisible, setSidebarVisibleState] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		GetSidebarVisible()
			.then((visible) => {
				setSidebarVisibleState(visible);
			})
			.catch((err) => {
				BackendLogger.error("[useSidebarSetting] Failed to get sidebar visibility:", err);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	const setSidebarVisible = useCallback(
		async (visible: boolean) => {
			const previousValue = sidebarVisible;
			// Optimistic update
			setSidebarVisibleState(visible);

			try {
				await SetSidebarVisible(visible);
			} catch (err) {
				BackendLogger.error("[useSidebarSetting] Failed to set sidebar visibility:", err);
				// Revert on error
				setSidebarVisibleState(previousValue);
				throw err;
			}
		},
		[sidebarVisible],
	);

	const toggleSidebar = useCallback(async () => {
		const newVisible = !sidebarVisible;
		await setSidebarVisible(newVisible);
		// Announce the state change for screen readers
		if (newVisible) {
			announceForScreenReaders("Sidebar shown.");
		} else {
			announceForScreenReaders("Sidebar hidden. Press Ctrl+B to show.");
		}
	}, [sidebarVisible, setSidebarVisible]);

	return {
		sidebarVisible,
		isLoading,
		setSidebarVisible,
		toggleSidebar,
	};
}
