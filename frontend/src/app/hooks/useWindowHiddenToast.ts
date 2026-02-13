import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useToast } from "../../shared/ui";

export function useWindowHiddenToast(): void {
	const toast = useToast();

	useEffect(() => {
		const unsubscribe = Events.On("yanta/window/hidden", () => {
			toast.info(
				"YANTA is running in background. Press Ctrl+Shift+Y anywhere to restore, or click the taskbar icon",
				{ duration: 5000 },
			);
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [toast]);
}
