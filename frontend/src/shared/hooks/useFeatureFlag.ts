import type { FeatureFlagName } from "@/config/featureFlags";
import { useFeatureFlagsStore } from "../stores/featureFlags.store";

export interface UseFeatureFlagResult {
	enabled: boolean;
	isLoading: boolean;
}

export function useFeatureFlag(name: FeatureFlagName): UseFeatureFlagResult {
	const enabled = useFeatureFlagsStore((s) => s.flags[name]);
	const isLoading = useFeatureFlagsStore((s) => s.isLoading);
	return { enabled, isLoading };
}

