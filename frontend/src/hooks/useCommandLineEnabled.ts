import { useEffect, useState } from "react";
import { IsCommandLineEnabled } from "../../bindings/yanta/internal/system/service";

export interface UseCommandLineEnabledReturn {
	enabled: boolean;
	isLoading: boolean;
}

/**
 * Hook to check if the command line feature is enabled.
 * Controlled by YANTA_ENABLE_COMMAND_LINE environment variable.
 * Defaults to false (disabled).
 */
export function useCommandLineEnabled(): UseCommandLineEnabledReturn {
	const [enabled, setEnabled] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(true);

	useEffect(() => {
		IsCommandLineEnabled()
			.then((isEnabled) => {
				setEnabled(isEnabled);
			})
			.catch((err) => {
				console.error("[useCommandLineEnabled] Failed to check command line enabled:", err);
				setEnabled(false);
			})
			.finally(() => {
				setIsLoading(false);
			});
	}, []);

	return {
		enabled,
		isLoading,
	};
}
