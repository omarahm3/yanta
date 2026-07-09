import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { GetPlatform } from "../../../bindings/yanta/internal/system/service";
import { useToast } from "../../shared/ui";

export function useWindowHiddenToast(): void {
	const toast = useToast();

	useEffect(() => {
		const unsubscribe = Events.On("yanta/window/hidden", () => {
			GetPlatform()
				.then((platform) => {
					let message: string;
					if (platform === "windows") {
						message =
							"YANTA is running in background. Press Ctrl+Shift+Y anywhere to restore, or click the system tray icon";
					} else {
						message = "YANTA is running in background. Click the system tray icon to restore";
					}
					toast.info(message, { duration: 5000 });
				})
				.catch(() => {
					toast.info("YANTA is running in background. Click the system tray icon to restore", {
						duration: 5000,
					});
				});
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [toast]);
}
