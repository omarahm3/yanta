import { Events } from "@wailsio/runtime";
import { useEffect } from "react";
import { useToast } from "../../shared/ui";

type BackendToastPayload = {
	type: "info" | "success" | "warning" | "error";
	message: string;
	duration?: number;
};

export function useBackendToast(): void {
	const toast = useToast();

	useEffect(() => {
		const unsubscribe = Events.On("yanta/ui/toast", (ev) => {
			const payload = ev.data as BackendToastPayload | undefined;
			if (!payload) {
				return;
			}

			const duration = payload.duration ?? 6000;
			switch (payload.type) {
				case "warning":
					toast.warning(payload.message, { duration });
					break;
				case "error":
					toast.error(payload.message, { duration });
					break;
				case "success":
					toast.success(payload.message, { duration });
					break;
				default:
					toast.info(payload.message, { duration });
			}
		});

		return () => {
			if (unsubscribe) {
				unsubscribe();
			}
		};
	}, [toast]);
}
