import { useCallback, useEffect, useState } from "react";
import {
	GetAppScale,
	SetAppScale,
	SetLogLevel,
} from "../../bindings/yanta/internal/system/service";
import type { SelectOption } from "../components/ui";
import { useScale } from "../contexts";
import { useNotification } from "../hooks/useNotification";
import { BackendLogger } from "../utils/backendLogger";

export interface UseAppearanceSettingsOptions {
	setNeedsRestart?: (value: boolean) => void;
	/** Call after log level change to refresh displayed system info (e.g. log level in UI). */
	refreshSystemInfo?: () => void;
}

const logLevelOptions: SelectOption[] = [
	{ value: "debug", label: "Debug" },
	{ value: "info", label: "Info" },
	{ value: "warn", label: "Warning" },
	{ value: "error", label: "Error" },
];

export function useAppearanceSettings(options: UseAppearanceSettingsOptions = {}) {
	const { setNeedsRestart, refreshSystemInfo } = options;
	const [appScale, setAppScaleState] = useState<number>(1.0);
	const { success, error } = useNotification();
	const { setScale } = useScale();

	useEffect(() => {
		GetAppScale()
			.then((scale) => setAppScaleState(scale))
			.catch((err) => BackendLogger.error("Failed to get app scale:", err));
	}, []);

	const handleAppScaleChange = useCallback(
		async (scale: number) => {
			try {
				await SetAppScale(scale);
				setAppScaleState(scale);
				setScale(scale);
			} catch (err) {
				error(`Failed to set app scale: ${err}`);
			}
		},
		[setScale, error],
	);

	const handleLogLevelChange = useCallback(
		async (level: string) => {
			try {
				await SetLogLevel(level);
				setNeedsRestart?.(true);
				success(`Log level set to ${level}. Please restart the application.`);
				refreshSystemInfo?.();
			} catch (err) {
				error(`Failed to set log level: ${err}`);
			}
		},
		[success, error, setNeedsRestart, refreshSystemInfo],
	);

	return {
		appScale,
		logLevelOptions,
		handleAppScaleChange,
		handleLogLevelChange,
	};
}
