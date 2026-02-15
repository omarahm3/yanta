import { useEffect, useState } from "react";
// IsCommandLineEnabled will be available after regenerating bindings
// For now, we'll use a dynamic import pattern that handles the missing export gracefully
import * as SystemService from "../../../bindings/yanta/internal/system/service";
import { BackendLogger } from "../utils/backendLogger";

export interface UseCommandLineEnabledReturn {
	enabled: boolean;
	isLoading: boolean;
}

/**
 * Hook to check if the command line feature is enabled.
 * Controlled by backend-resolved feature flags (config.toml + env override).
 */
export function useCommandLineEnabled(): UseCommandLineEnabledReturn {
	const [enabled, setEnabled] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		// Check if the function exists (may not be available until bindings are regenerated)
		const isCommandLineEnabled = (SystemService as Record<string, unknown>).IsCommandLineEnabled as
			| (() => Promise<boolean>)
			| undefined;

		if (typeof isCommandLineEnabled === "function") {
			isCommandLineEnabled()
				.then((isEnabled: boolean) => {
					setEnabled(isEnabled);
				})
				.catch((err: Error) => {
					BackendLogger.error("[useCommandLineEnabled] Failed to check command line enabled:", err);
					setEnabled(false);
				})
				.finally(() => {
					setIsLoading(false);
				});
		} else {
			// Function not available yet, default to disabled
			setEnabled(false);
			setIsLoading(false);
		}
	}, []);

	return {
		enabled,
		isLoading,
	};
}
