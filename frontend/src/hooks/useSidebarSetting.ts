import { useCallback, useEffect, useState } from "react";
import {
	GetSidebarVisible,
	SetSidebarVisible,
} from "../../bindings/yanta/internal/system/service";

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
				console.error("[useSidebarSetting] Failed to get sidebar visibility:", err);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	const setSidebarVisible = useCallback(async (visible: boolean) => {
		const previousValue = sidebarVisible;
		// Optimistic update
		setSidebarVisibleState(visible);

		try {
			await SetSidebarVisible(visible);
		} catch (err) {
			console.error("[useSidebarSetting] Failed to set sidebar visibility:", err);
			// Revert on error
			setSidebarVisibleState(previousValue);
			throw err;
		}
	}, [sidebarVisible]);

	const toggleSidebar = useCallback(async () => {
		await setSidebarVisible(!sidebarVisible);
	}, [sidebarVisible, setSidebarVisible]);

	return {
		sidebarVisible,
		isLoading,
		setSidebarVisible,
		toggleSidebar,
	};
}
