import { useEffect } from "react";
import { useFeatureFlagsStore } from "../shared/stores/featureFlags.store";

export function FeatureFlagsStoreInit() {
	useEffect(() => {
		useFeatureFlagsStore.getState().loadFlags();
	}, []);

	return null;
}
