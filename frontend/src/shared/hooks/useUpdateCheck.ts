import { useCallback, useEffect, useState } from "react";
import { CheckForUpdate } from "../../../bindings/yanta/internal/system/service";
import { type UpdateInfo, updateInfoFromModel } from "../types";
import { BackendLogger } from "../utils/backendLogger";

/**
 * localStorage key holding the latest version the user has dismissed. Keying on
 * the version (rather than a boolean) means dismissing one update never hides a
 * future, newer one.
 */
const DISMISSED_VERSION_KEY = "yanta:update:dismissedVersion";

function readDismissedVersion(): string | null {
	try {
		return localStorage.getItem(DISMISSED_VERSION_KEY);
	} catch {
		return null;
	}
}

export interface UseUpdateCheckOptions {
	/** When true, run a check once on mount. Defaults to false. */
	autoCheck?: boolean;
}

export interface UseUpdateCheckReturn {
	/** Result of the most recent check, or null if none has completed. */
	updateInfo: UpdateInfo | null;
	/** True while a check is in flight. */
	isChecking: boolean;
	/** True when the most recent manual check failed (e.g. offline). */
	checkFailed: boolean;
	/** Run an update check now. Returns the result, or null on failure. */
	check: () => Promise<UpdateInfo | null>;
	/** Dismiss the prompt for the current latest version (persisted). */
	dismiss: () => void;
	/**
	 * True when an update is available AND the user has not dismissed this
	 * specific version. Drives the non-intrusive prompt.
	 */
	showPrompt: boolean;
}

/**
 * Checks GitHub Releases for a newer version of YANTA and tracks per-version
 * dismissal so the prompt stays non-intrusive: it never blocks work, and once
 * dismissed it does not reappear for the same version.
 */
export function useUpdateCheck(options: UseUpdateCheckOptions = {}): UseUpdateCheckReturn {
	const { autoCheck = false } = options;
	const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
	const [isChecking, setIsChecking] = useState(false);
	const [checkFailed, setCheckFailed] = useState(false);
	const [dismissedVersion, setDismissedVersion] = useState<string | null>(readDismissedVersion);

	const check = useCallback(async (): Promise<UpdateInfo | null> => {
		setIsChecking(true);
		setCheckFailed(false);
		try {
			const model = await CheckForUpdate();
			const info = model ? updateInfoFromModel(model) : null;
			if (info) setUpdateInfo(info);
			return info;
		} catch (err) {
			// Best-effort: a failed check (offline, rate-limited) must never
			// surface as an error the user has to dismiss.
			BackendLogger.warn("Update check failed:", err);
			setCheckFailed(true);
			return null;
		} finally {
			setIsChecking(false);
		}
	}, []);

	useEffect(() => {
		if (autoCheck) void check();
	}, [autoCheck, check]);

	const dismiss = useCallback(() => {
		const version = updateInfo?.latestVersion;
		if (!version) return;
		try {
			localStorage.setItem(DISMISSED_VERSION_KEY, version);
		} catch {
			// Non-fatal: dismissal simply won't persist across restarts.
		}
		setDismissedVersion(version);
	}, [updateInfo]);

	const showPrompt = Boolean(
		updateInfo?.available &&
			updateInfo.latestVersion &&
			updateInfo.latestVersion !== dismissedVersion,
	);

	return { updateInfo, isChecking, checkFailed, check, dismiss, showPrompt };
}
