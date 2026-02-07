import { useEffect } from "react";
import { GetAppScale } from "../../bindings/yanta/internal/system/service";
import { useScaleStore } from "../shared/stores/scale.store";
import { BackendLogger } from "../utils/backendLogger";

/**
 * Runs once on app mount: loads scale from backend and applies it.
 * Replaces the init that lived in ScaleProvider.
 */
export function ScaleStoreInit() {
	useEffect(() => {
		GetAppScale()
			.then((value) => {
				useScaleStore.getState().setScale(value);
			})
			.catch((err) => {
				BackendLogger.error("Failed to load app scale:", err);
				useScaleStore.getState().setScale(1.0);
			});
	}, []);
	return null;
}
