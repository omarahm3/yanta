import { useCallback, useEffect, useRef, useState } from "react";
import {
	GetSidebarVisible,
	SetSidebarVisible,
} from "../../../bindings/yanta/internal/system/service";
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
	const sidebarVisibleRef = useRef(sidebarVisible);

	useEffect(() => {
		sidebarVisibleRef.current = sidebarVisible;
	}, [sidebarVisible]);

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

	const setSidebarVisible = useCallback(async (visible: boolean) => {
		// Optimistic update using functional setState to avoid closure chain
		setSidebarVisibleState(visible);

		try {
			await SetSidebarVisible(visible);
		} catch (err) {
			BackendLogger.error("[useSidebarSetting] Failed to set sidebar visibility:", err);
			// Revert on error using functional form
			setSidebarVisibleState((prev) => (prev === visible ? !visible : prev));
			throw err;
		}
	}, []);

	const toggleSidebar = useCallback(async () => {
		const newVisible = !sidebarVisibleRef.current;
		setSidebarVisibleState(newVisible);

		try {
			await SetSidebarVisible(newVisible);
		} catch (err) {
			BackendLogger.error("[useSidebarSetting] Failed to set sidebar visibility:", err);
			setSidebarVisibleState((prev) => (prev === newVisible ? !newVisible : prev));
			throw err;
		}
		if (newVisible) {
			announceForScreenReaders("Sidebar shown.");
		} else {
			announceForScreenReaders("Sidebar hidden. Press Ctrl+B to show.");
		}
	}, []);

	return {
		sidebarVisible,
		isLoading,
		setSidebarVisible,
		toggleSidebar,
	};
}
