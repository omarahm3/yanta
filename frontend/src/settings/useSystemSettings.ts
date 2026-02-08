import { Events } from "@wailsio/runtime";
import { useCallback, useEffect, useState } from "react";
import {
	GetHotkeyConfig,
	GetKeepInBackground,
	GetPlatform,
	GetStartHidden,
	GetSystemInfo,
	ReindexDatabase,
	SetHotkeyConfig,
	SetKeepInBackground,
	SetStartHidden,
} from "../../bindings/yanta/internal/system/service";
import { GetWindowMode, SetWindowMode } from "../../bindings/yanta/internal/window/service";
import { useNotification } from "../hooks/useNotification";
import {
	type GlobalHotkeyConfig,
	globalHotkeyConfigFromModel,
	globalHotkeyConfigToModel,
	type SystemInfo,
	systemInfoFromModel,
} from "../types";
import { BackendLogger } from "../utils/backendLogger";

export interface UseSystemSettingsOptions {
	setNeedsRestart?: (value: boolean) => void;
}

export function useSystemSettings(options: UseSystemSettingsOptions = {}) {
	const { setNeedsRestart } = options;
	const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
	const [keepInBackground, setKeepInBackgroundState] = useState(false);
	const [startHidden, setStartHiddenState] = useState(false);
	const [linuxWindowMode, setLinuxWindowModeState] = useState<string>("normal");
	const [platform, setPlatform] = useState<string>("");
	const [hotkeyConfig, setHotkeyConfigState] = useState<GlobalHotkeyConfig>({
		quickCaptureEnabled: false,
		quickCaptureHotkey: "Ctrl+Shift+N",
	});
	const [hotkeyError, setHotkeyError] = useState<string | undefined>();
	const [isReindexing, setIsReindexing] = useState(false);
	const [reindexProgress, setReindexProgress] = useState<{
		current: number;
		total: number;
		message: string;
	} | null>(null);
	const [showReindexConfirm, setShowReindexConfirm] = useState(false);
	const { success, error } = useNotification();

	useEffect(() => {
		GetSystemInfo()
			.then((model) => {
				if (model) setSystemInfo(systemInfoFromModel(model));
			})
			.catch((err) => BackendLogger.error("Failed to fetch system info:", err));

		GetKeepInBackground()
			.then((value) => setKeepInBackgroundState(value))
			.catch((err) => BackendLogger.error("Failed to fetch keep in background setting:", err));

		GetStartHidden()
			.then((value) => setStartHiddenState(value))
			.catch((err) => BackendLogger.error("Failed to fetch start hidden setting:", err));

		GetWindowMode()
			.then((mode) => setLinuxWindowModeState(mode))
			.catch((err) => BackendLogger.error("Failed to get window mode:", err));

		GetPlatform()
			.then((p) => setPlatform(p))
			.catch((err) => BackendLogger.error("Failed to get platform:", err));

		GetHotkeyConfig()
			.then((config) => setHotkeyConfigState(globalHotkeyConfigFromModel(config)))
			.catch((err) => BackendLogger.error("Failed to get hotkey config:", err));

		const unsubscribe = Events.On("reindex:progress", (data: unknown) => {
			const progressData = data as { current: number; total: number; message: string };
			setReindexProgress({
				current: progressData.current,
				total: progressData.total,
				message: progressData.message,
			});
		});

		return () => unsubscribe();
	}, []);

	const refreshSystemInfo = useCallback(() => {
		GetSystemInfo()
			.then((model) => {
				if (model) setSystemInfo(systemInfoFromModel(model));
			})
			.catch((err) => BackendLogger.error("Failed to fetch system info:", err));
	}, []);

	const handleKeepInBackgroundToggle = useCallback(
		async (enabled: boolean) => {
			try {
				await SetKeepInBackground(enabled);
				setKeepInBackgroundState(enabled);
				if (!enabled) setStartHiddenState(false);
			} catch (err) {
				error(`Failed to update setting: ${err}`);
			}
		},
		[error],
	);

	const handleStartHiddenToggle = useCallback(
		async (enabled: boolean) => {
			try {
				await SetStartHidden(enabled);
				setStartHiddenState(enabled);
			} catch (err) {
				error(`Failed to update setting: ${err}`);
			}
		},
		[error],
	);

	const handleLinuxWindowModeToggle = useCallback(
		async (frameless: boolean) => {
			try {
				const mode = frameless ? "frameless" : "normal";
				await SetWindowMode(mode);
				setLinuxWindowModeState(mode);
				setNeedsRestart?.(true);
				success(
					frameless
						? "Frameless mode enabled. Please restart the application."
						: "Normal window mode enabled. Please restart the application.",
				);
			} catch (err) {
				error(`Failed to update window mode: ${err}`);
			}
		},
		[success, error, setNeedsRestart],
	);

	const handleHotkeyConfigChange = useCallback(
		async (config: GlobalHotkeyConfig) => {
			if (config.quickCaptureEnabled && !config.quickCaptureHotkey) {
				setHotkeyError("Please set a hotkey");
				return;
			}
			setHotkeyError(undefined);
			setHotkeyConfigState(config);
			try {
				await SetHotkeyConfig(globalHotkeyConfigToModel(config));
			} catch (err) {
				const errorMessage = String(err);
				const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
				setHotkeyError(cleanedMessage);
				error(`Failed to update hotkey: ${cleanedMessage}`);
			}
		},
		[error],
	);

	const handleRequestReindex = useCallback(() => {
		setShowReindexConfirm(true);
	}, []);

	const handleConfirmReindex = useCallback(async () => {
		try {
			setShowReindexConfirm(false);
			setIsReindexing(true);
			setReindexProgress({ current: 0, total: 0, message: "Starting..." });
			await ReindexDatabase();
			success("Database reindexed successfully");
			setReindexProgress(null);
		} catch (err) {
			const errorMessage = String(err);
			const cleanedMessage = errorMessage.replace(/^[A-Z_]+:\s*/, "");
			error(`Reindex failed:\n\n${cleanedMessage}`);
			setReindexProgress(null);
		} finally {
			setIsReindexing(false);
		}
	}, [success, error]);

	const handleCancelReindex = useCallback(() => {
		setShowReindexConfirm(false);
	}, []);

	return {
		systemInfo,
		refreshSystemInfo,
		keepInBackground,
		startHidden,
		linuxWindowMode,
		platform,
		hotkeyConfig,
		hotkeyError,
		isReindexing,
		reindexProgress,
		showReindexConfirm,
		handleKeepInBackgroundToggle,
		handleStartHiddenToggle,
		handleLinuxWindowModeToggle,
		handleHotkeyConfigChange,
		handleRequestReindex,
		handleConfirmReindex,
		handleCancelReindex,
	};
}
