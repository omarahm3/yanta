import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useToast } from "../../shared/ui";

export function useWindowHiddenToast(): void {
	const toast = useToast();

	useEffect(() => {
		const unsubscribe = Events.On("yanta/window/hidden", (event) => {
			const platform = event?.data?.platform;
			const message =
				platform === "windows"
					? "YANTA is running in background. Press Ctrl+Shift+Y anywhere to restore, or click the system tray icon"
					: "YANTA is running in background. Click the system tray icon to restore";
			toast.info(message, { duration: 5000 });
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [toast]);
}
